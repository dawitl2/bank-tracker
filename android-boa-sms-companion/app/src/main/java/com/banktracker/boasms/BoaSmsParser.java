package com.banktracker.boasms;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class BoaSmsParser {
    private static final Pattern MONEY_PATTERN = Pattern.compile(
        "(?i)(?:ETB|Birr)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)\\s*(?:ETB|Birr)?"
    );
    private static final Pattern BOA_AVAILABLE_BALANCE_PATTERN = Pattern.compile(
        "(?i)\\b(?:available|current|new|remaining)?\\s*balance\\s*(?::|is)?\\s*(?:ETB|Birr)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)"
    );
    private static final Pattern BOA_DEBIT_PATTERN = Pattern.compile(
        "(?i)\\bdebited\\s+with\\s*(?:ETB|Birr)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)"
    );
    private static final Pattern BOA_CREDIT_PATTERN = Pattern.compile(
        "(?i)\\bcredited\\s+with\\s*(?:ETB|Birr)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)"
    );
    private static final String[] BALANCE_LABELS = {
        "available balance is",
        "available balance",
        "current balance is",
        "current balance",
        "new balance is",
        "new balance",
        "remaining balance is",
        "remaining balance",
        "balance is",
        "balance",
        "avl bal",
        "avail bal",
        "available bal"
    };

    private BoaSmsParser() {
    }

    static boolean isBoaSender(String sender) {
        if (sender == null) return false;

        String normalized = sender.toLowerCase(Locale.US).replaceAll("[^a-z0-9]", "");
        return normalized.equals("boa")
            || normalized.contains("bankofabyssinia")
            || normalized.contains("abyssinia")
            || normalized.contains("boabank")
            || normalized.contains("boasms");
    }

    static BoaSmsUpdate parse(String sender, String body) {
        if (body == null) {
            return null;
        }

        String text = body.replace('\n', ' ').replace('\r', ' ').replaceAll("\\s+", " ").trim();
        String lower = text.toLowerCase(Locale.US);

        if (!isBoaSender(sender) && !isBoaBody(lower)) {
            return null;
        }

        if (isOtp(lower) || isPromotion(lower) || !containsAccountSignal(lower)) {
            return null;
        }

        String balance = findExact(text, BOA_AVAILABLE_BALANCE_PATTERN);
        if (balance == null) {
            balance = findBalanceAmount(text);
        }

        String withdrawal = findExact(text, BOA_DEBIT_PATTERN);
        if (withdrawal == null && containsAny(lower, "withdraw", "withdrawn", "debited", "debit", "paid", "purchase", "transferred to", "sent to")) {
            withdrawal = findTransactionAmount(text, new String[] {
                "withdrawn", "withdraw", "debited with", "debited by", "debited", "debit",
                "paid", "purchase", "transferred to", "sent to", "amount"
            });
        }

        String deposit = findExact(text, BOA_CREDIT_PATTERN);
        if (deposit == null && containsAny(lower, "deposit", "deposited", "credited", "credit", "received", "transferred from")) {
            deposit = findTransactionAmount(text, new String[] {
                "deposited with", "deposited by", "deposited", "deposit",
                "credited with", "credited by", "credited", "credit",
                "received", "transferred from", "amount"
            });
        }

        BoaSmsUpdate update = new BoaSmsUpdate(balance, withdrawal, deposit);
        return update.hasValues() ? update : null;
    }

    private static boolean isBoaBody(String lower) {
        return lower.contains("bank of abyssinia")
            || lower.contains("bankofabyssinia.com")
            || lower.contains("cs.bankofabyssinia.com");
    }

    private static boolean isOtp(String lower) {
        return containsAny(lower, "otp", "one time password", "one-time password", "verification code", "security code", "password reset");
    }

    private static boolean isPromotion(String lower) {
        return containsAny(lower, "promo", "promotion", "offer", "discount", "campaign", "win ", "lottery", "bonus", "advert");
    }

    private static boolean containsAccountSignal(String lower) {
        return containsAny(
            lower,
            "balance",
            "avl bal",
            "avail bal",
            "withdraw",
            "withdrawn",
            "debited",
            "credited",
            "deposit",
            "deposited",
            "received",
            "paid"
        );
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }

        return false;
    }

    private static String findExact(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? cleanAmount(matcher.group(1)) : null;
    }

    private static String findBalanceAmount(String text) {
        String afterLabel = findAmountAfterAny(text, BALANCE_LABELS);
        if (afterLabel != null) {
            return afterLabel;
        }

        return findAmountBeforeAny(text, BALANCE_LABELS);
    }

    private static String findAmountAfterAny(String text, String[] labels) {
        String lower = text.toLowerCase(Locale.US);

        for (String label : labels) {
            int index = lower.indexOf(label);
            if (index < 0) continue;

            int start = index + label.length();
            int end = Math.min(text.length(), start + 100);
            String nearby = text.substring(start, end);
            String amount = firstAmount(nearby);

            if (amount != null) {
                return amount;
            }
        }

        return null;
    }

    private static String findAmountBeforeAny(String text, String[] labels) {
        String lower = text.toLowerCase(Locale.US);

        for (String label : labels) {
            int index = lower.indexOf(label);
            if (index < 0) continue;

            int start = Math.max(0, index - 40);
            String nearby = text.substring(start, index);
            String amount = lastAmount(nearby);

            if (amount != null) {
                return amount;
            }
        }

        return null;
    }

    private static String findTransactionAmount(String text, String[] labels) {
        String balanceAmount = findBalanceAmount(text);
        String labeledAmount = findAmountAfterAny(text, labels);

        if (labeledAmount != null && !labeledAmount.equals(balanceAmount)) {
            return labeledAmount;
        }

        labeledAmount = findAmountBeforeAny(text, labels);

        if (labeledAmount != null && !labeledAmount.equals(balanceAmount)) {
            return labeledAmount;
        }

        Matcher matcher = MONEY_PATTERN.matcher(text);
        while (matcher.find()) {
            String amount = cleanAmount(matcher.group(1));

            if (!amount.equals(balanceAmount)) {
                return amount;
            }
        }

        return null;
    }

    private static String firstAmount(String text) {
        Matcher matcher = MONEY_PATTERN.matcher(text);
        return matcher.find() ? cleanAmount(matcher.group(1)) : null;
    }

    private static String lastAmount(String text) {
        Matcher matcher = MONEY_PATTERN.matcher(text);
        String amount = null;

        while (matcher.find()) {
            amount = cleanAmount(matcher.group(1));
        }

        return amount;
    }

    private static String cleanAmount(String amount) {
        return amount == null ? null : amount.replace(",", "");
    }
}
