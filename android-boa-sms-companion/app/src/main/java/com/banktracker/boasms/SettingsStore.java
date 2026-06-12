package com.banktracker.boasms;

import android.content.Context;
import android.content.SharedPreferences;

final class SettingsStore {
    private static final String PREFS = "boa_sms_companion";
    private static final String KEY_API_URL = "api_url";
    private static final String KEY_API_TOKEN = "api_token";
    private static final String KEY_LAST_STATUS = "last_status";

    private SettingsStore() {
    }

    static String getApiUrl(Context context) {
        return getPrefs(context).getString(KEY_API_URL, "https://bank-backend-anhp.onrender.com");
    }

    static String getApiToken(Context context) {
        return getPrefs(context).getString(KEY_API_TOKEN, "boa123");
    }

    static void saveConnection(Context context, String apiUrl, String token) {
        getPrefs(context)
            .edit()
            .putString(KEY_API_URL, trimTrailingSlash(apiUrl))
            .putString(KEY_API_TOKEN, token.trim())
            .apply();
    }

    static String getLastStatus(Context context) {
        return getPrefs(context).getString(KEY_LAST_STATUS, "No BOA SMS updates sent yet.");
    }

    static void setLastStatus(Context context, String status) {
        getPrefs(context).edit().putString(KEY_LAST_STATUS, status).apply();
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value == null ? "" : value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
