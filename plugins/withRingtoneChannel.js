const { withMainActivity } = require('@expo/config-plugins');

/**
 * Plays incoming call notifications with the phone's REAL ringtone.
 *
 * Why it is necessary: expo-notifications only accepts files inside the app
 * as the channel sound, if it cannot find it, it falls back to the default NOTIFICATION sound
 * (SoundResolver.kt). Because of this, phone's ringtones
 * (e.g. "Nostalgia") could not be accessed.
 *
 * Solution: We create the channel on the native side with
 * Settings.System.DEFAULT_RINGTONE_URI. This address does not point to a fixed file,
 * it points to the phone's current ringtone; when the user changes the ringtone, the app plays that one too.
 */
const CHANNEL_ID = 'calls_ring_system';

const CHANNEL_CODE = `
  /**
   * Creates the call notification channel with the phone's ringtone.
   * Because channel settings cannot be changed later on Android, the channel
   * is only created the first time.
   */
  private fun setupCallChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel("\${CHANNEL_ID}") != null) return

    val channel = NotificationChannel(
      "\${CHANNEL_ID}",
      "Calls",
      NotificationManager.IMPORTANCE_HIGH
    )
    channel.description = "Incoming voice and video calls"

    // Sound plays from the RINGTONE channel, not notification: it uses the phone's ring volume
    // and obeys silent/do not disturb settings.
    val audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    // Not a fixed file, but the phone's current ringtone.
    channel.setSound(Settings.System.DEFAULT_RINGTONE_URI, audioAttributes)
    channel.enableVibration(true)
    channel.vibrationPattern = longArrayOf(0, 1000, 800, 1000, 800, 1000)
    channel.lightColor = 0xFF25D366.toInt()
    channel.enableLights(true)

    manager.createNotificationChannel(channel)
  }
`;

module.exports = function withRingtoneChannel(config) {
  return withMainActivity(config, (cfg) => {
    let content = cfg.modResults.contents;

    if (content.includes('setupCallChannel')) return cfg;

    if (cfg.modResults.language !== 'kt') {
      throw new Error('[withRingtoneChannel] MainActivity is not Kotlin; plugin should be updated.');
    }

    // Required imports
    const importsToAdd = [
      'import android.app.NotificationChannel',
      'import android.app.NotificationManager',
      'import android.media.AudioAttributes',
      'import android.provider.Settings',
    ];
    const prevContent = content;
    content = content.replace(
      'import android.os.Bundle',
      `import android.os.Bundle\n${importsToAdd.join('\n')}`
    );
    if (content === prevContent) {
      throw new Error('[withRingtoneChannel] import point not found.');
    }

    // Setup channel when the app opens
    content = content.replace(
      'super.onCreate(null)',
      'super.onCreate(null)\n    setupCallChannel()'
    );
    if (!content.includes('setupCallChannel()')) {
      throw new Error('[withRingtoneChannel] could not add call into onCreate.');
    }

    // Add function to the class (before the first method)
    content = content.replace(
      '  /**\n   * Returns the name of the main component',
      `${CHANNEL_CODE}\n  /**\n   * Returns the name of the main component`
    );

    cfg.modResults.contents = content;
    return cfg;
  });
};

module.exports.CHANNEL_ID = CHANNEL_ID;
