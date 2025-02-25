import { Instance, SnapshotOut, types } from "mobx-state-tree"
import { AppState, Platform } from "react-native"
import RevenueCat, { LOG_LEVEL, PurchasesOffering, PurchasesPackage, CustomerInfo } from "react-native-purchases"
import auth from "@react-native-firebase/auth"
import DeviceInfo from "react-native-device-info"

const checkIsPro = (customerInfo: CustomerInfo) => {
  return !!customerInfo.entitlements.active["better-rail-pro"]
}

export const PurchasesModel = types
  .model("Purchases")
  .props({
    isPro: types.maybe(types.boolean),
  })
  .views(() => ({
    get customerInfo() {
      return RevenueCat.getCustomerInfo()
    },
    get offerings() {
      return RevenueCat.getOfferings().then((offerings) => offerings.current.availablePackages)
    },
  }))
  .actions((self) => ({
    setIsPro(isPro: boolean) {
      self.isPro = isPro
    },
    async afterCreate() {
      RevenueCat.setLogLevel(LOG_LEVEL.DEBUG)

      if (Platform.OS === "ios") {
        RevenueCat.configure({ apiKey: "appl_pOArhScpRECBNsNeIwfRCkYlsfZ", appUserID: auth().currentUser?.uid })

        const isBetaTester = await this.isBetaTester()

        if (isBetaTester) {
          this.setIsPro(true)
        } else {
          AppState.addEventListener("change", async (currentState) => {
            if (currentState === "active") {
              const customerInfo = await self.customerInfo
              this.setIsPro(checkIsPro(customerInfo))
            }
          })
        }
      }
    },
    purchaseOffering(offering: keyof PurchasesOffering) {
      return RevenueCat.getOfferings()
        .then((offerings) => offerings.current[offering] as PurchasesPackage)
        .then((selectedPackage) => RevenueCat.purchasePackage(selectedPackage))
        .then((result) => {
          this.setIsPro(checkIsPro(result.customerInfo))
          return result
        })
    },
    purchaseMonthly() {
      return this.purchaseOffering("monthly")
    },
    purchaseAnnual() {
      return this.purchaseOffering("annual")
    },
    restorePurchases() {
      return RevenueCat.restorePurchases().then((customerInfo) => {
        this.setIsPro(checkIsPro(customerInfo))
        return customerInfo
      })
    },
    async isBetaTester() {
      return DeviceInfo.getInstallerPackageName().then((value) => {
        return value == "TestFlight"
      })
    },
  }))

type PurchasesType = Instance<typeof PurchasesModel>
export interface Purchases extends PurchasesType {}
type PurchasesSnapshotType = SnapshotOut<typeof PurchasesModel>
export interface PurchasesSnapshot extends PurchasesSnapshotType {}
export const createPurchasesDefaultModel = () => types.optional(PurchasesModel, {})
