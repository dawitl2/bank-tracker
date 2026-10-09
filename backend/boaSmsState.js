function mergeFields(current, incoming) {
  const result = { ...incoming };
  for (const [amount, timestamp] of [
    ["current_balance", "balance_updated_at"],
    ["latest_withdrawal_amount", "withdrawal_updated_at"],
    ["latest_deposit_amount", "deposit_updated_at"]
  ]) {
    if (!incoming[timestamp] || (current[timestamp] && Date.parse(incoming[timestamp]) < Date.parse(current[timestamp]))) {
      delete result[amount]; delete result[timestamp];
    }
  }
  if (current.last_sms_at && Date.parse(incoming.last_sms_at) < Date.parse(current.last_sms_at)) {
    delete result.last_sms_at; delete result.last_sender; delete result.last_message_hash;
  }
  return result;
}

async function saveBoaSmsState(supabase, incoming) {
  const result = await supabase.rpc("merge_boa_sms_state", { incoming }).single();
  if (!["PGRST202", "42883", "42501"].includes(result.error?.code)) return result;
  // Compatibility during rollout: retain the existing state endpoint until SQL is applied.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await supabase.from("boa_sms_account_state").select("*").eq("id", incoming.id).maybeSingle();
    if (current.error) return current;
    if (!current.data) {
      const inserted = await supabase.from("boa_sms_account_state").insert(incoming).select().single();
      if (inserted.error?.code === "23505") continue;
      return inserted;
    }
    const update = mergeFields(current.data, incoming);
    let query = supabase.from("boa_sms_account_state").update(update).eq("id", incoming.id).eq("updated_at", current.data.updated_at);
    for (const timestamp of ["balance_updated_at", "withdrawal_updated_at", "deposit_updated_at", "last_sms_at"]) {
      query = current.data[timestamp] ? query.eq(timestamp, current.data[timestamp]) : query.is(timestamp, null);
    }
    const saved = await query.select().maybeSingle();
    if (saved.error || saved.data) return saved;
  }
  return { error: { message: "Concurrent SMS update; retry delivery" } };
}

module.exports = { mergeFields, saveBoaSmsState };
