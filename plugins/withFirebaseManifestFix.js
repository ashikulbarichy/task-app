const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to resolve Android Manifest merge conflicts between
 * @react-native-firebase/messaging and expo-notifications.
 *
 * Both libraries declare:
 * - com.google.firebase.messaging.default_notification_channel_id
 * - com.google.firebase.messaging.default_notification_color
 *
 * By injecting `tools:replace="android:value"` and `tools:replace="android:resource"`,
 * Gradle's manifest merger will cleanly override @react-native-firebase's empty defaults
 * with the values defined by expo-notifications without throwing a merger error.
 */
const withFirebaseManifestFix = (config) => {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    let metaDataList = mainApplication['meta-data'];
    if (!metaDataList) {
      metaDataList = [];
      mainApplication['meta-data'] = metaDataList;
    }

    const channelMeta = metaDataList.find(
      (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
    );
    if (channelMeta) {
      channelMeta.$['tools:replace'] = 'android:value';
    } else {
      metaDataList.push({
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
          'android:value': 'delivery-updates',
          'tools:replace': 'android:value',
        },
      });
    }

    const colorMeta = metaDataList.find(
      (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    );
    if (colorMeta) {
      colorMeta.$['tools:replace'] = 'android:resource';
    } else {
      metaDataList.push({
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_color',
          'android:resource': '@color/notification_icon_color',
          'tools:replace': 'android:resource',
        },
      });
    }

    return config;
  });
};

module.exports = withFirebaseManifestFix;
