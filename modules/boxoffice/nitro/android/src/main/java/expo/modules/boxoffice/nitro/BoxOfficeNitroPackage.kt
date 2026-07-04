package expo.modules.boxoffice.nitro

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.NitroModules

/**
 * Nitro package registration for the BoxOffice module.
 * Registers the BoxOfficeNitroModule with both Nitro and React Native.
 */
class BoxOfficeNitroPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        // Initialize Nitro modules
        NitroModules.installBoxOfficeModule(reactContext)
        
        // Return the Nitro module as a NativeModule
        return listOf(
            BoxOfficeNitroModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}