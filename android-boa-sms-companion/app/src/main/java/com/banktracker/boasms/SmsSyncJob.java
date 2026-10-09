package com.banktracker.boasms;

import android.app.job.JobParameters;
import android.app.job.JobService;

public final class SmsSyncJob extends JobService {
    private final java.util.concurrent.ConcurrentHashMap<Integer, java.util.concurrent.atomic.AtomicBoolean> cancellations = new java.util.concurrent.ConcurrentHashMap<>();
    @Override public boolean onStartJob(JobParameters parameters) {
        final java.util.concurrent.atomic.AtomicBoolean stopped = new java.util.concurrent.atomic.AtomicBoolean(false);
        cancellations.put(parameters.getJobId(), stopped);
        new Thread(() -> {
            boolean retry = false;
            try {
                SmsDelivery.reconcileInbox(this);
                SmsDelivery.flush(this, stopped::get);
            } catch (Exception error) {
                retry = true;
                SettingsStore.setLastStatus(this, "SMS saved for automatic retry: " + error.getMessage());
            }
            final boolean reschedule = retry || SmsDelivery.hasPending(this);
            new android.os.Handler(getMainLooper()).post(() -> {
                cancellations.remove(parameters.getJobId(), stopped);
                if (!stopped.get()) jobFinished(parameters, reschedule);
            });
        }, "boa-sms-delivery").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters parameters) {
        java.util.concurrent.atomic.AtomicBoolean cancellation = cancellations.remove(parameters.getJobId());
        if (cancellation != null) cancellation.set(true);
        return true;
    }
}
