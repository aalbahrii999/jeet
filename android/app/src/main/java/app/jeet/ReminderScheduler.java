package app.jeet;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public final class ReminderScheduler {
    static final String PREFS = "jeet.reminders";
    static final String CHANNEL = "jeet.gym";
    private static final String ACTION = "app.jeet.REMIND";

    private ReminderScheduler() {}

    public static void sync(Context context, String json) {
        try {
            JSONObject object = new JSONObject(json);
            StringBuilder days = new StringBuilder();
            JSONArray array = object.optJSONArray("days");
            if (array != null) {
                for (int i = 0; i < array.length(); i++) {
                    if (days.length() > 0) days.append(',');
                    days.append(array.optInt(i, -1));
                }
            }
            prefs(context).edit()
                    .putBoolean("enabled", object.optBoolean("enabled", true))
                    .putString("time", object.optString("time", "18:00"))
                    .putString("days", days.toString())
                    .putBoolean("skipToday", object.optBoolean("skipToday", false))
                    .putString("today", object.optString("today", ""))
                    .apply();
        } catch (Exception ignored) {
            // Keep the previous schedule if the payload is unreadable.
        }
        schedule(context);
    }

    public static void schedule(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        for (int day = 0; day < 7; day++) {
            alarms.cancel(pending(context, day));
        }
        SharedPreferences store = prefs(context);
        if (!store.getBoolean("enabled", true)) return;
        String raw = store.getString("days", "6,1,3");
        if (raw == null || raw.isEmpty()) return;
        int hour = 18;
        int minute = 0;
        String time = store.getString("time", "18:00");
        if (time != null && time.contains(":")) {
            String[] parts = time.split(":");
            try {
                hour = Integer.parseInt(parts[0]);
                minute = Integer.parseInt(parts[1]);
            } catch (NumberFormatException ignored) {
                hour = 18;
                minute = 0;
            }
        }
        boolean skipToday = store.getBoolean("skipToday", false);
        String today = store.getString("today", "");
        long now = System.currentTimeMillis();
        for (String part : raw.split(",")) {
            int jsDay;
            try {
                jsDay = Integer.parseInt(part.trim());
            } catch (NumberFormatException ignored) {
                continue;
            }
            if (jsDay < 0 || jsDay > 6) continue;
            long when = next(jsDay, hour, minute, now);
            if (skipToday && today != null && today.equals(ymd(when))) {
                when += 7L * 24L * 60L * 60L * 1000L;
            }
            PendingIntent intent = pending(context, jsDay);
            try {
                if (canExact(alarms)) {
                    alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
                } else {
                    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
                }
            } catch (SecurityException ignored) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
            }
        }
    }

    public static void show(Context context) {
        ensureChannel(context);
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
                context,
                7,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(context.getString(R.string.notify_title))
                .setContentText(context.getString(R.string.notify_body))
                .setColor(0xFFF08A24)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap);
        try {
            NotificationManagerCompat.from(context).notify(42, builder.build());
        } catch (SecurityException ignored) {
            // Permission was revoked between the check and the post.
        }
    }

    public static void markAsked(Context context) {
        prefs(context).edit().putBoolean("asked", true).apply();
    }

    public static String status(Context context) {
        boolean enabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= 33) {
            enabled = enabled && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        if (enabled) return "granted";
        return prefs(context).getBoolean("asked", false) ? "denied" : "default";
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                context.getString(R.string.notify_channel),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.notify_channel_desc));
        manager.createNotificationChannel(channel);
    }

    private static boolean canExact(AlarmManager alarms) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return alarms.canScheduleExactAlarms();
    }

    private static PendingIntent pending(Context context, int jsDay) {
        Intent intent = new Intent(context, NotifyReceiver.class);
        intent.setAction(ACTION);
        return PendingIntent.getBroadcast(
                context,
                100 + jsDay,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static long next(int jsDay, int hour, int minute, long now) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        calendar.set(Calendar.HOUR_OF_DAY, hour);
        calendar.set(Calendar.MINUTE, minute);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        int javaDow = jsDay + 1;
        int delta = (javaDow - calendar.get(Calendar.DAY_OF_WEEK) + 7) % 7;
        calendar.add(Calendar.DAY_OF_YEAR, delta);
        if (calendar.getTimeInMillis() <= now) calendar.add(Calendar.DAY_OF_YEAR, 7);
        return calendar.getTimeInMillis();
    }

    private static String ymd(long millis) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(millis);
        return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH) + 1,
                calendar.get(Calendar.DAY_OF_MONTH)
        );
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
