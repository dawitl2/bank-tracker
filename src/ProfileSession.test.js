import { act, renderHook, waitFor } from "@testing-library/react";
import { ProfileProvider, useProfile } from "./ProfileSession";

const STORAGE_KEY = "bank-tracker:profile-session:v1";
const REVOCATION_KEY = "bank-tracker:profile-revocations:v1";
const token = "a".repeat(64);
const session = {
  token, persistent: true, expires_at: null,
  profile: { username: "dawit", name: "Dawit", apollo_access: true, interest_access: true }
};
const response = data => ({ ok: true, status: 200, json: async () => data });
const mount = () => renderHook(() => useProfile(), { wrapper: ProfileProvider });
const originalFetch = global.fetch;
const originalTimeout = AbortSignal.timeout;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue(response(session));
  AbortSignal.timeout = jest.fn(() => undefined);
});
afterEach(() => {
  global.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
  jest.useRealTimers();
});

test("device login survives years, tab closure and a fresh app start without a password", async () => {
  jest.useFakeTimers();
  const first = mount();
  await act(async () => first.result.current.signIn(" Dawit ", "test-password"));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
  expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain("test-password");
  act(() => jest.advanceTimersByTime(10 * 365 * 24 * 60 * 60 * 1000));
  expect(first.result.current.profile).toEqual(session.profile);
  first.unmount();
  global.fetch.mockClear();
  const reopened = mount();
  await act(async () => {});
  expect(reopened.result.current.profile).toEqual(session.profile);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("app_profile_session"),
    expect.objectContaining({ body: JSON.stringify({ p_token: token }) }));
});

test("an older session-storage token is moved to persistent device storage", async () => {
  sessionStorage.setItem(STORAGE_KEY, token);
  const view = mount();
  await waitFor(() => expect(view.result.current.profile).toEqual(session.profile));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
  expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
});

test.each(["network", "server"])("a %s failure on focus keeps the verified account signed in", async failure => {
  localStorage.setItem(STORAGE_KEY, token);
  const view = mount();
  await waitFor(() => expect(view.result.current.profile).toEqual(session.profile));
  if (failure === "network") global.fetch.mockRejectedValueOnce(new Error("Offline"));
  else global.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current.profile).toEqual(session.profile);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
  global.fetch.mockResolvedValueOnce(response(null));
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(view.result.current.profile).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

test("offline cold start keeps the token and restores access when connected", async () => {
  localStorage.setItem(STORAGE_KEY, token);
  global.fetch.mockRejectedValueOnce(new Error("Offline"));
  const view = mount();
  await waitFor(() => expect(view.result.current.checking).toBe(false));
  expect(view.result.current.remembered).toBe(true);
  expect(view.result.current.profile).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(token);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(view.result.current.profile).toEqual(session.profile);
});

test("explicit logout clears this device and revokes its token with an empty 204 response", async () => {
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem("apollo_visibility_day", "today");
  localStorage.setItem("interest_visibility_day", "today");
  const view = mount();
  await waitFor(() => expect(view.result.current.profile).toEqual(session.profile));
  global.fetch.mockResolvedValue({ ok: true, status: 204 });
  await act(async () => view.result.current.signOut());
  expect(view.result.current.profile).toBeNull();
  expect(view.result.current.remembered).toBe(false);
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(localStorage.getItem("apollo_visibility_day")).toBeNull();
  expect(localStorage.getItem("interest_visibility_day")).toBeNull();
  expect(JSON.parse(localStorage.getItem(REVOCATION_KEY))).toEqual([]);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("app_profile_sign_out"),
    expect.objectContaining({ body: JSON.stringify({ p_token: token }) }));
});

test("offline logout remains signed out and retries server revocation on reconnect", async () => {
  localStorage.setItem(STORAGE_KEY, token);
  const view = mount();
  await waitFor(() => expect(view.result.current.profile).toEqual(session.profile));
  global.fetch.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => {
    await expect(view.result.current.signOut()).rejects.toThrow();
  });
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(JSON.parse(localStorage.getItem(REVOCATION_KEY))).toEqual([token]);
  global.fetch.mockResolvedValue({ ok: true, status: 204 });
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(JSON.parse(localStorage.getItem(REVOCATION_KEY))).toEqual([]);
  expect(view.result.current.profile).toBeNull();
});

test("logout in another tab invalidates an in-flight session check", async () => {
  localStorage.setItem(STORAGE_KEY, token);
  const view = mount();
  await waitFor(() => expect(view.result.current.profile).toEqual(session.profile));
  let finishCheck;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishCheck = resolve; }));
  act(() => window.dispatchEvent(new Event("focus")));
  localStorage.removeItem(STORAGE_KEY);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: null })));
  await act(async () => finishCheck(response(session)));
  expect(view.result.current.profile).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
