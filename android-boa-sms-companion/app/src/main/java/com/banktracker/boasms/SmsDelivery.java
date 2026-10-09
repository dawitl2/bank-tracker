package com.banktracker.boasms;

import android.Manifest;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.Telephony;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

final class SmsDelivery {
    private static final Object LOCK = new Object();
    private static final int JOB_ID = 4101;
    private static final int RECOVERY_JOB_ID = 4102;
    private static final long WINDOW = 31L * 24 * 60 * 60 * 1000;

    static String hash(String sender, String body) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest((sender + "\n" + body).getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format("%02x", value));
        return result.toString();
    }

    static void enqueue(Context context, BoaSmsUpdate update, String sender, long receivedAt, String hash, boolean eventOnly, boolean force) throws Exception {
        String path = eventOnly ? "/boa-sms/events" : "/boa-sms/account-state";
        String key = path + ":" + hash;
        synchronized (LOCK) {
            if (!force && sent(context).contains(key)) return;
            JSONObject item = new JSONObject();
            item.put("path", path);
            item.put("body", ApiClient.smsPayload(update, sender, receivedAt, hash));
            if (!pending(context).edit().putString(key, item.toString()).commit()) throw new IllegalStateException("Could not save SMS for retry");
        }
    }

    static void schedule(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        // Periodic reconciliation also recovers broadcasts missed by vendor background restrictions.
        if (scheduler.getPendingJob(RECOVERY_JOB_ID) == null) {
            scheduler.schedule(new JobInfo.Builder(RECOVERY_JOB_ID, new ComponentName(context, SmsSyncJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15 * 60 * 1000L).build());
        }
        if (scheduler.getPendingJob(JOB_ID) != null) return;
        int result = scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, SmsSyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
            .setBackoffCriteria(30000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
        if (result != JobScheduler.RESULT_SUCCESS) SettingsStore.setLastStatus(context, "SMS saved. Reopen the companion to retry delivery.");
    }

    static boolean hasPending(Context context) {
        synchronized (LOCK) { return !pending(context).getAll().isEmpty(); }
    }

    static void flush(Context context, java.util.function.BooleanSupplier stopped) throws Exception {
        if (!hasPending(context)) return;
        // An older backend cannot retain the new fields or merge delayed account updates safely.
        JSONObject serverState = new JSONObject(ApiClient.fetchAccountState(context));
        if (serverState.optInt("delivery_version", 0) < 2) throw new IllegalStateException("Waiting for the backend update; SMS remains queued.");
        while (!stopped.getAsBoolean()) {
            String key = null;
            JSONObject item = null;
            synchronized (LOCK) {
                long oldest = Long.MAX_VALUE;
                for (Map.Entry<String, ?> entry : pending(context).getAll().entrySet()) {
                    JSONObject candidate = new JSONObject((String) entry.getValue());
                    long timestamp = java.time.Instant.parse(candidate.getJSONObject("body").getString("sms_received_at")).toEpochMilli();
                    if (timestamp < oldest) { oldest = timestamp; key = entry.getKey(); item = candidate; }
                }
            }
            if (item == null) return;
            ApiClient.postPayload(context, item.getString("path"), item.getJSONObject("body"));
            synchronized (LOCK) {
                // A success lost before this acknowledgement is safe to resend: server hashes are unique.
                if (!sent(context).edit().putLong(key, System.currentTimeMillis()).commit()) throw new IllegalStateException("Could not acknowledge SMS");
                if (!pending(context).edit().remove(key).commit()) throw new IllegalStateException("Could not clear delivered SMS");
            }
            SettingsStore.setLastStatus(context, "BOA SMS delivered successfully.");
        }
    }

    static void reconcileInbox(Context context) throws Exception {
        if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) return;
        long cutoff = System.currentTimeMillis() - WINDOW;
        try (Cursor cursor = context.getContentResolver().query(Telephony.Sms.Inbox.CONTENT_URI,
            new String[] { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE },
            Telephony.Sms.DATE + " >= ?", new String[] { String.valueOf(cutoff) }, Telephony.Sms.DATE + " ASC")) {
            if (cursor != null) while (cursor.moveToNext()) {
                String sender = cursor.getString(0), body = cursor.getString(1);
                BoaSmsUpdate update = BoaSmsParser.parse(sender, body);
                if (update != null) enqueue(context, update, sender, cursor.getLong(2), hash(sender, body), false, false);
            }
        }
        synchronized (LOCK) {
            SharedPreferences.Editor editor = sent(context).edit();
            for (Map.Entry<String, ?> entry : sent(context).getAll().entrySet()) {
                if ((Long) entry.getValue() < cutoff) editor.remove(entry.getKey());
            }
            editor.apply();
        }
    }

    private static SharedPreferences pending(Context context) { return context.getSharedPreferences("boa_sms_outbox_v1", Context.MODE_PRIVATE); }
    private static SharedPreferences sent(Context context) { return context.getSharedPreferences("boa_sms_delivered_v1", Context.MODE_PRIVATE); }
}
