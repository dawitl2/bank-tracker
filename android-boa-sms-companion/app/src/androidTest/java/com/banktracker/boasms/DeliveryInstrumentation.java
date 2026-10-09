package com.banktracker.boasms;

import android.app.Instrumentation;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import android.os.Bundle;
import java.net.HttpURLConnection;
import java.net.URL;

// Runs against a disposable test API via adb reverse tcp:5002 tcp:5002.
// Uses separate test preferences, never the user's inbox, token or companion outbox.
public final class DeliveryInstrumentation extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            Context isolated = new ContextWrapper(getTargetContext()) {
                @Override public SharedPreferences getSharedPreferences(String name, int mode) {
                    return super.getSharedPreferences("delivery_test_" + name, mode);
                }
            };
            isolated.getSharedPreferences("boa_sms_outbox_v1", Context.MODE_PRIVATE).edit().clear().commit();
            isolated.getSharedPreferences("boa_sms_delivered_v1", Context.MODE_PRIVATE).edit().clear().commit();
            SettingsStore.saveConnection(isolated, "http://127.0.0.1:5002", "test-only");
            BoaSmsUpdate update = BoaSmsParser.parse("BOA", "Account debited with ETB 1200.50 on 09/10/2026 11:30. Reference: FT26282TEST. Narrative: Materials Available balance: ETB 9000.00 https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349");
            SmsDelivery.enqueue(isolated, update, "BOA", 1791534600000L, "instrumentation-only", false, false);
            check(SmsDelivery.hasPending(isolated), "SMS must be persisted before sending");
            boolean failed = false;
            try { SmsDelivery.flush(isolated, () -> false); } catch (Exception expected) { failed = true; }
            check(failed && SmsDelivery.hasPending(isolated), "Failed delivery must retain the outbox item");
            HttpURLConnection recovery = (HttpURLConnection) new URL("http://127.0.0.1:5002/test/recover").openConnection();
            recovery.setRequestMethod("POST");
            check(recovery.getResponseCode() == 200, "Test API recovery failed");
            recovery.disconnect();
            SmsDelivery.flush(isolated, () -> false);
            check(!SmsDelivery.hasPending(isolated), "Successful retry must clear the outbox");
            SmsDelivery.enqueue(isolated, update, "BOA", 1791534600000L, "instrumentation-only", false, false);
            check(!SmsDelivery.hasPending(isolated), "An acknowledged SMS must not be queued again");
            result.putString("stream", "PASS: persisted queue, failed-send retention, successful retry, acknowledged SMS deduplication.\n");
            result.putInt("passed", 4);
            finish(-1, result);
        } catch (Throwable error) {
            result.putString("stream", "FAIL: " + error + "\n");
            finish(0, result);
        }
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}
