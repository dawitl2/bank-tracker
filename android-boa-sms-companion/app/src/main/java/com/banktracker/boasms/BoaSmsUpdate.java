package com.banktracker.boasms;

final class BoaSmsUpdate {
    final String currentBalance;
    final String latestWithdrawalAmount;
    final String latestDepositAmount;

    BoaSmsUpdate(String currentBalance, String latestWithdrawalAmount, String latestDepositAmount) {
        this.currentBalance = currentBalance;
        this.latestWithdrawalAmount = latestWithdrawalAmount;
        this.latestDepositAmount = latestDepositAmount;
    }

    boolean hasValues() {
        return currentBalance != null || latestWithdrawalAmount != null || latestDepositAmount != null;
    }
}
