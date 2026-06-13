package com.banktracker.boasms;

import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class ApiClient {
    private ApiClient() {
    }

    static void sendUpdate(
        Context context,
        BoaSmsUpdate update,
        String sender,
        long receivedAtMillis,
        String messageHash
    ) throws Exception {
        String apiUrl = SettingsStore.getApiUrl(context);
        String token = SettingsStore.getApiToken(context);

        if (apiUrl.isEmpty() || token.isEmpty()) {
            throw new IllegalStateException("Backend URL or token is not configured.");
        }

        JSONObject body = new JSONObject();
        body.put("sender", sender);
        body.put("sms_received_at", isoUtc(receivedAtMillis));
        body.put("message_hash", messageHash);

        if (update.currentBalance != null) {
            body.put("current_balance", update.currentBalance);
        }

        if (update.latestWithdrawalAmount != null) {
            body.put("latest_withdrawal_amount", update.latestWithdrawalAmount);
        }

        if (update.latestDepositAmount != null) {
            body.put("latest_deposit_amount", update.latestDepositAmount);
        }

        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl + "/boa-sms/account-state").openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Authorization", "Bearer " + token);

        try (OutputStream stream = connection.getOutputStream()) {
            stream.write(bytes);
        }

        int status = connection.getResponseCode();

        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Backend returned HTTP " + status);
        }
    }

    static String fetchAccountState(Context context) throws Exception {
        String apiUrl = SettingsStore.getApiUrl(context);

        if (apiUrl.isEmpty()) {
            throw new IllegalStateException("Backend URL is not configured.");
        }

        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl + "/boa-sms/account-state").openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);

        int status = connection.getResponseCode();
        String response = readResponse(status >= 200 && status < 300
            ? connection.getInputStream()
            : connection.getErrorStream());

        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Backend returned HTTP " + status + ": " + response);
        }

        return response;
    }

    private static String readResponse(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }

        byte[] buffer = new byte[4096];
        StringBuilder response = new StringBuilder();
        int read;

        while ((read = stream.read(buffer)) != -1) {
            response.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
        }

        return response.toString();
    }

    private static String isoUtc(long millis) {
        return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US) {{
            setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        }}.format(new java.util.Date(millis));
    }
}
