import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { buildReviewPacket } from "./utils/reviewPacket.js";

const MAX_LENGTH = 5000;
const REQUEST_TIMEOUT_MS = 45_000;
const DRAFT_STORAGE_KEY = "clear-writing:draft:v1";
const PREVIOUS_DRAFT_STORAGE_KEY = "clear-writing:previous-draft:v1";
const VOICE_STORAGE_KEY = "clear-writing:team-voice:v1";
const PROTECTED_TERMS_STORAGE_KEY = "clear-writing:protected-terms:v1";
const SNIPPETS_STORAGE_KEY = "clear-writing:snippets:v1";
const ACCOUNT_STORAGE_KEY = "clear-writing:account:v1";
const WORKSPACE_ID_KEY = "clear-writing:workspace-id:v1";
const MAX_VOICE_LENGTH = 500;
const MAX_SNIPPET_LENGTH = 300;
const MAX_PROTECTED_TERMS = 20;
const MAX_PROTECTED_TERM_LENGTH = 80;
const MAX_CONTEXT_FIELD_LENGTH = 240;
const ACCOUNTS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
const sampleDrafts = [
  {
    label: "Project update",
    format: "general",
    text: "Hi team, the new onboarding flow is ready for review. I’m checking the mobile layout today and will share a link by 4 p.m. Please send any feedback before then.",
  },
  {
    label: "Meeting follow-up",
    format: "general",
    text: "Thanks for today’s planning meeting. I’ll update the timeline by Thursday and confirm the open questions with engineering. Could you share the latest pricing note before then?",
  },
  {
    label: "Customer email",
    format: "customer_email",
    text: "Hello, I’m following up on the proposal we discussed. Please let me know if you have any questions. I can share more detail if helpful.",
  },
  {
    label: "Internal update",
    format: "internal_update",
    text: "The onboarding flow is ready for review. The mobile layout check is underway. Please send feedback before the next release-planning meeting. No release date has been confirmed.",
  },
  {
    label: "Meeting recap",
    format: "meeting_recap",
    text: "Decision: keep the first release focused on onboarding. Open question: who owns the analytics review? Next step: share the updated scope with the team. No owner or due date was assigned during the meeting.",
  },
];
const API_URL = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "")
  || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");

function readEmailAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("verify")) return { type: "verify", uid: params.get("verify"), token: params.get("token") };
  if (params.has("reset")) return { type: "reset", uid: params.get("reset"), token: params.get("token") };
  return null;
}

function readInviteToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("invite") || "";
}

function readWorkspaceId() {
  try {
    const value = Number(sessionStorage.getItem(WORKSPACE_ID_KEY));
    return Number.isInteger(value) && value > 0 ? value : "";
  } catch {
    return "";
  }
}

function storeWorkspaceId(value) {
  try {
    if (value) sessionStorage.setItem(WORKSPACE_ID_KEY, String(value));
    else sessionStorage.removeItem(WORKSPACE_ID_KEY);
  } catch {
    // Workspace selection remains available for this tab when storage is unavailable.
  }
}

function readSessionDraft(key = DRAFT_STORAGE_KEY) {
  try {
    return [...(sessionStorage.getItem(key) || "")].slice(0, MAX_LENGTH).join("");
  } catch {
    return "";
  }
}

function persistSessionDraft(value, key = DRAFT_STORAGE_KEY) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readSessionValue(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function readSnippets() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SNIPPETS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.text === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function readAccount() {
  try {
    const account = JSON.parse(sessionStorage.getItem(ACCOUNT_STORAGE_KEY) || "null");
    return account?.access && account?.refresh ? account : null;
  } catch {
    return null;
  }
}

function storeAccount(account) {
  try {
    if (account) sessionStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    else sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    // Account use stays available until this tab closes when storage is unavailable.
  }
}

async function authenticatedRequest(config, account) {
  const send = (access) => axios({
    ...config,
    headers: { ...config.headers, Authorization: `Bearer ${access}` },
  });
  try {
    return { response: await send(account.access), account };
  } catch (error) {
    if (error.response?.status !== 401 || !account.refresh) throw error;
    const refreshed = await axios.post(`${API_URL}/api/auth/token/refresh/`, { refresh: account.refresh });
    const nextAccount = { ...account, access: refreshed.data.access, refresh: refreshed.data.refresh || account.refresh };
    return { response: await send(nextAccount.access), account: nextAccount };
  }
}

function App() {
  const [text, setText] = useState(readSessionDraft);
  const [draftStorageStatus, setDraftStorageStatus] = useState(() => {
    try {
      return sessionStorage.getItem(DRAFT_STORAGE_KEY) ? "saved" : "ready";
    } catch {
      return "unavailable";
    }
  });
  const [mode, setMode] = useState("rewrite");
  const [style, setStyle] = useState("clear");
  const [format, setFormat] = useState("general");
  const [voiceGuidance, setVoiceGuidance] = useState(() => readSessionValue(VOICE_STORAGE_KEY).slice(0, MAX_VOICE_LENGTH));
  const [protectedTermsText, setProtectedTermsText] = useState(() => readSessionValue(PROTECTED_TERMS_STORAGE_KEY));
  const [contextBrief, setContextBrief] = useState({ reader: "", goal: "", must_keep: "", avoid: "" });
  const [snippets, setSnippets] = useState(readSnippets);
  const [snippetDraft, setSnippetDraft] = useState("");
  const [account, setAccount] = useState(readAccount);
  const [emailAction, setEmailAction] = useState(readEmailAction);
  const [inviteToken, setInviteToken] = useState(readInviteToken);
  const [accountMode, setAccountMode] = useState(() => emailAction?.type === "reset" ? "reset-password" : "register");
  const [verificationPending, setVerificationPending] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [onboardingEmailsOptIn, setOnboardingEmailsOptIn] = useState(false);
  const [emailPreferenceSaving, setEmailPreferenceSaving] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(readWorkspaceId);
  const [loadedWorkspaceKey, setLoadedWorkspaceKey] = useState("");
  const [invitations, setInvitations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamUpdating, setTeamUpdating] = useState(false);
  const [billingUpdating, setBillingUpdating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState(() => emailAction?.type === "reset" ? "Choose a new password for your account." : "");
  const [accountError, setAccountError] = useState("");
  const [result, setResult] = useState("");
  const [rationales, setRationales] = useState([]);
  const [explainChanges, setExplainChanges] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [reviewPacketOpen, setReviewPacketOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [previousDraft, setPreviousDraft] = useState(() => readSessionDraft(PREVIOUS_DRAFT_STORAGE_KEY));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [processingConfirmed, setProcessingConfirmed] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Share result");
  const [copyStatus, setCopyStatus] = useState("");
  const textareaRef = useRef(null);
  const accountPanelRef = useRef(null);
  const characterCount = [...text].length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const workspaceRequestKey = account ? `${account.email}:${activeWorkspaceId || "default"}` : "";
  const workspaceLoading = Boolean(account && loadedWorkspaceKey !== workspaceRequestKey);

  useEffect(() => {
    if (!account || !API_URL) return undefined;
    let active = true;
    const workspaceQuery = activeWorkspaceId ? `?workspace_id=${activeWorkspaceId}` : "";
    authenticatedRequest({ method: "get", url: `${API_URL}/api/workspace/${workspaceQuery}` }, account)
      .then(({ response, account: updatedAccount }) => {
        if (!active) return;
        setAccount(updatedAccount);
        storeAccount(updatedAccount);
        setOnboardingEmailsOptIn(Boolean(response.data.email_preferences?.onboarding_emails));
        const selected = response.data.workspace || (response.data.id ? response.data : null);
        setWorkspace(selected ? { ...selected, workspaces: response.data.workspaces || selected.workspaces || [] } : null);
        if (selected?.id) {
          storeWorkspaceId(selected.id);
          setVoiceGuidance(selected.voice_guidance);
          const selectedTerms = Array.isArray(selected.protected_terms) ? selected.protected_terms : [];
          setProtectedTermsText(selectedTerms.join("\n"));
          setSnippets(selected.snippets.map((text, index) => ({ id: `saved-${index}`, text })));
          persistSessionDraft(selected.voice_guidance, VOICE_STORAGE_KEY);
          try { sessionStorage.setItem(PROTECTED_TERMS_STORAGE_KEY, selectedTerms.join("\n")); } catch { /* current workspace settings remain usable */ }
          try { sessionStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(selected.snippets.map((text, index) => ({ id: `saved-${index}`, text })))); } catch { /* in-memory account settings remain usable */ }
        }
        setAccountMessage(selected ? "Workspace settings loaded." : inviteToken ? "Sign in to accept your workspace invitation." : "Accept a workspace invitation to continue.");
        setAccountError("");
        setLoadedWorkspaceKey(workspaceRequestKey);
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 404 && activeWorkspaceId) {
          setActiveWorkspaceId("");
          storeWorkspaceId(null);
          return;
        }
        storeAccount(null);
        setAccount(null);
        setWorkspace(null);
        setActiveWorkspaceId("");
        storeWorkspaceId(null);
        setLoadedWorkspaceKey("");
        setAccountError("Your sign-in expired. Please sign in again.");
      });
    return () => { active = false; };
  }, [account, workspaceRequestKey, inviteToken, activeWorkspaceId]);

  useEffect(() => {
    if (!account || !workspace?.id || workspace.role !== "owner" || !API_URL) return undefined;
    let active = true;
    authenticatedRequest({ method: "get", url: `${API_URL}/api/workspace/team/?workspace_id=${workspace.id}` }, account)
      .then(({ response, account: updatedAccount }) => {
        if (!active) return;
        setAccount(updatedAccount);
        storeAccount(updatedAccount);
        setTeamMembers(response.data.members);
        setInvitations(response.data.invitations || []);
      })
      .catch(() => { if (active) { setInvitations([]); setTeamMembers([]); } });
    return () => { active = false; };
  }, [account, workspace?.id, workspace?.role]);

  useEffect(() => {
    if (!emailAction || !ACCOUNTS_ENABLED || !API_URL) return undefined;
    if (accountPanelRef.current) accountPanelRef.current.open = true;
    if (emailAction.type === "reset") {
      return undefined;
    }
    let active = true;
    axios.post(`${API_URL}/api/auth/verify-email/`, { uid: emailAction.uid, token: emailAction.token })
      .then((response) => {
        if (!active) return;
        setAccountMode("login");
        setVerificationPending(false);
        setAccountMessage(response.data.message);
        setAccountError("");
        setEmailAction(null);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((requestError) => {
        if (!active) return;
        setAccountMode("login");
        setAccountError(requestError.response?.data?.error || "Email verification link is invalid or expired.");
        setEmailAction(null);
        window.history.replaceState({}, "", window.location.pathname);
      });
    return () => { active = false; };
  }, [emailAction]);

  const submit = async () => {
    if (!API_URL || !text.trim() || characterCount > MAX_LENGTH || !adultConfirmed || !processingConfirmed || loading || workspaceLoading) return;
    setLoading(true);
    setError("");
    setResult("");
    setRationales([]);
    setComparisonOpen(false);
    setCopyStatus("");

    try {
      const payload = { text, mode, style, format, voice_guidance: voiceGuidance, protected_terms: protectedTermsText.split(/\r?\n/).map((term) => term.trim()).filter(Boolean), adult_confirmed: adultConfirmed, external_processing_confirmed: processingConfirmed, ...(workspace?.id ? { workspace_id: workspace.id } : {}) };
      payload.context_brief = contextBrief;
      payload.include_rationale = explainChanges && mode === "rewrite";
      const currentAccount = account
        ? workspace?.role === "owner" ? await saveWorkspaceSettings() : account
        : null;
      if (account && workspace?.role === "owner" && !currentAccount) return;
      const { response, account: updatedAccount } = currentAccount
        ? await authenticatedRequest({ method: "post", url: `${API_URL}/api/rewrite/`, data: payload, timeout: REQUEST_TIMEOUT_MS }, currentAccount)
        : { response: await axios.post(`${API_URL}/api/rewrite/`, payload, { timeout: REQUEST_TIMEOUT_MS }), account: null };
      if (updatedAccount) {
        setAccount(updatedAccount);
        storeAccount(updatedAccount);
      }
      if (response.data.usage) setWorkspace((current) => current ? { ...current, usage: response.data.usage } : current);
      setResult(response.data.result);
      setRationales(response.data.rationales || []);
    } catch (requestError) {
      const response = axios.isAxiosError(requestError) ? requestError.response : undefined;
      const code = axios.isAxiosError(requestError) ? requestError.code : undefined;
      const serverMessage = response?.data?.error;
      if (response?.data?.usage) setWorkspace((current) => current ? { ...current, usage: response.data.usage } : current);
      setError(
        response?.status === 429
          ? (typeof serverMessage === "string" ? serverMessage : "You’ve reached the demo request limit. Try again later; your draft is still here.")
          : code === "ECONNABORTED" || code === "ETIMEDOUT"
            ? "The request timed out. Your draft is still here; wait a moment before retrying."
          : (typeof serverMessage === "string" && serverMessage) ||
            (response
              ? "The writing service returned an unexpected response. Try again."
              : "Couldn’t reach the writing service. Check your connection and try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountMessage("");
    try {
      if (accountMode === "reset-password") {
        if (!emailAction) throw new Error("Open the password reset link from your email first.");
        const response = await axios.post(`${API_URL}/api/auth/password-reset/confirm/`, {
          uid: emailAction.uid, token: emailAction.token, new_password: accountPassword,
        });
        setAccountMode("login");
        setAccountPassword("");
        setEmailAction(null);
        setAccountMessage(response.data.message);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      if (accountMode === "reset-request") {
        const response = await axios.post(`${API_URL}/api/auth/password-reset/`, { email: accountEmail });
        setAccountMessage(response.data.message);
        return;
      }
      if (accountMode === "register") {
        const response = await axios.post(`${API_URL}/api/auth/register/`, {
          email: accountEmail, password: accountPassword, workspace_name: inviteToken ? "" : workspaceName,
          onboarding_emails: onboardingEmailsOptIn,
          ...(inviteToken ? { invitation_token: inviteToken } : {}),
        });
        setAccountMode("login");
        setVerificationPending(true);
        setAccountPassword("");
        setOnboardingEmailsOptIn(false);
        setAccountMessage(response.data.message);
        return;
      }
      const response = await axios.post(`${API_URL}/api/auth/token/`, { email: accountEmail, password: accountPassword });
      const nextAccount = { email: accountEmail.trim().toLowerCase(), access: response.data.access, refresh: response.data.refresh };
      storeAccount(nextAccount);
      setAccount(nextAccount);
      setAccountPassword("");
      setVerificationPending(false);
      setAccountMessage("Signed in.");
    } catch (requestError) {
      const data = requestError.response?.data;
      const message = typeof data?.error === "string" ? data.error
        : Object.values(data || {}).flat().find((value) => typeof value === "string")
          || "Could not sign in. Check the details and try again.";
      setAccountError(message);
    }
  };

  const saveEmailPreferences = async (event) => {
    event.preventDefault();
    if (!account || !API_URL || emailPreferenceSaving) return;
    setEmailPreferenceSaving(true);
    setAccountError("");
    try {
      const { response, account: updatedAccount } = await authenticatedRequest({
        method: "patch",
        url: `${API_URL}/api/account/email-preferences/`,
        data: { onboarding_emails: onboardingEmailsOptIn },
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setAccountMessage(response.data.welcome_sent || !onboardingEmailsOptIn
        ? "Email preference saved."
        : "Preference saved. The getting-started email could not be delivered; save again to retry.");
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not save your email preference.");
    } finally {
      setEmailPreferenceSaving(false);
    }
  };

  const resendVerification = async () => {
    setAccountError("");
    try {
      const response = await axios.post(`${API_URL}/api/auth/verify-resend/`, { email: accountEmail, invitation_token: inviteToken });
      setAccountMessage(response.data.message);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not send a verification email right now.");
    }
  };

  const saveWorkspaceSettings = async () => {
    if (!account || !workspace?.id) return;
    const protectedTerms = protectedTermsText.split(/\r?\n/).map((term) => term.trim()).filter(Boolean);
    if (protectedTerms.length > MAX_PROTECTED_TERMS || protectedTerms.some((term) => term.length > MAX_PROTECTED_TERM_LENGTH)) {
      setAccountError(`Use up to ${MAX_PROTECTED_TERMS} protected terms, with no more than ${MAX_PROTECTED_TERM_LENGTH} characters each.`);
      return;
    }
    setAccountError("");
    setAccountMessage("Saving workspace settings…");
    try {
      const { response, account: updatedAccount } = await authenticatedRequest({
        method: "patch",
        url: `${API_URL}/api/workspace/?workspace_id=${workspace?.id || activeWorkspaceId}`,
        data: { voice_guidance: voiceGuidance, snippets: snippets.map((item) => item.text), protected_terms: protectedTerms },
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setWorkspace(response.data);
      setAccountMessage("Team writing settings saved to your workspace.");
      return updatedAccount;
    } catch {
      setAccountError("Could not save workspace settings. Please try again.");
      setAccountMessage("");
      return null;
    }
  };

  const restoreStyleGuideVersion = async (versionId) => {
    if (!account || !workspace?.id) return;
    setAccountError("");
    setAccountMessage("Restoring saved style guide…");
    try {
      const { response, account: updatedAccount } = await authenticatedRequest({
        method: "post",
        url: `${API_URL}/api/workspace/style-guide/${versionId}/restore/`,
        data: { workspace_id: workspace.id },
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setWorkspace((current) => ({ ...current, ...response.data }));
      setVoiceGuidance(response.data.voice_guidance);
      setSnippets(response.data.snippets.map((text, index) => ({ id: `saved-${index}`, text })));
      persistSessionDraft(response.data.voice_guidance, VOICE_STORAGE_KEY);
      try { sessionStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(response.data.snippets.map((text, index) => ({ id: `saved-${index}`, text })))); } catch { /* account settings remain usable in memory */ }
      setAccountMessage("Saved style guide restored.");
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not restore this style guide.");
      setAccountMessage("");
    }
  };

  const sendWorkspaceInvitation = async (event) => {
    event.preventDefault();
    if (!account || !workspace?.id || inviting) return;
    setInviting(true);
    setAccountError("");
    try {
      const { response, account: updatedAccount } = await authenticatedRequest({
        method: "post", url: `${API_URL}/api/workspace/invitations/`,
        data: { workspace_id: workspace.id, email: inviteEmail },
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setInviteEmail("");
      setAccountMessage(response.data.message);
      setInvitations((current) => [...current.filter((item) => item.email !== response.data.invitation.email), response.data.invitation]);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not send the invitation.");
    } finally {
      setInviting(false);
    }
  };

  const openBillingPage = async (kind) => {
    if (!account || !workspace?.id || billingUpdating) return;
    setBillingUpdating(true);
    setAccountError("");
    try {
      const request = kind === "checkout"
        ? { method: "post", url: `${API_URL}/api/billing/checkout/`, data: { workspace_id: workspace.id }, headers: { "Idempotency-Key": crypto.randomUUID() } }
        : { method: "post", url: `${API_URL}/api/billing/portal/`, data: { workspace_id: workspace.id } };
      const { response, account: updatedAccount } = await authenticatedRequest(request, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      const target = new URL(response.data.url);
      if (target.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(target.hostname)) throw new Error("The billing provider returned an invalid link.");
      window.location.assign(target.href);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || requestError.message || "Billing is temporarily unavailable.");
      setBillingUpdating(false);
    }
  };

  const acceptWorkspaceInvitation = async () => {
    if (!account || !inviteToken) return;
    setAccountError("");
    try {
      const { response, account: updatedAccount } = await authenticatedRequest({
        method: "post", url: `${API_URL}/api/workspace/invitations/accept/`, data: { token: inviteToken },
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setActiveWorkspaceId(response.data.workspace_id);
      storeWorkspaceId(response.data.workspace_id);
      setInviteToken("");
      window.history.replaceState({}, "", window.location.pathname);
      setAccountMessage(response.data.message);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not accept this invitation.");
    }
  };

  const revokeInvitation = async (invitationId) => {
    if (!account) return;
    try {
      const { account: updatedAccount } = await authenticatedRequest({
        method: "delete", url: `${API_URL}/api/workspace/invitations/${invitationId}/`,
      }, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      setInvitations((current) => current.filter((item) => item.id !== invitationId));
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not revoke this invitation.");
    }
  };

  const updateTeamMember = async (member, action) => {
    if (!account || !workspace?.id || teamUpdating) return;
    const message = action === "transfer"
      ? `Make ${member.email} the owner? You will become a member.`
      : `Remove ${member.email} from this workspace?`;
    if (!window.confirm(message)) return;
    setTeamUpdating(true);
    setAccountError("");
    try {
      const request = action === "transfer"
        ? { method: "post", url: `${API_URL}/api/workspace/team/ownership/`, data: { workspace_id: workspace.id, member_id: member.user_id } }
        : { method: "delete", url: `${API_URL}/api/workspace/team/${member.user_id}/?workspace_id=${workspace.id}` };
      const { response, account: updatedAccount } = await authenticatedRequest(request, account);
      setAccount(updatedAccount);
      storeAccount(updatedAccount);
      if (action === "transfer") {
        setWorkspace((current) => current ? { ...current, role: "member" } : current);
        setTeamMembers((current) => current.map((item) => ({
          ...item,
          role: item.user_id === member.user_id ? "owner" : item.email === account.email ? "member" : item.role,
        })));
        setInvitations([]);
      } else {
        setTeamMembers((current) => current.filter((item) => item.user_id !== member.user_id));
      }
      setAccountMessage(response.data?.message || `${member.email} removed from the workspace.`);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.error || "Could not update the workspace team.");
    } finally {
      setTeamUpdating(false);
    }
  };

  const signOut = async () => {
    try {
      if (account) {
        let activeAccount = account;
        const logoutRequest = () => axios.post(`${API_URL}/api/auth/logout/`, { refresh: activeAccount.refresh }, {
          headers: { Authorization: `Bearer ${activeAccount.access}` },
        });
        try {
          await logoutRequest();
        } catch (error) {
          if (error.response?.status !== 401) throw error;
          const refreshed = await axios.post(`${API_URL}/api/auth/token/refresh/`, { refresh: activeAccount.refresh });
          activeAccount = { ...activeAccount, access: refreshed.data.access, refresh: refreshed.data.refresh || activeAccount.refresh };
          await logoutRequest();
        }
      }
    } catch {
      // Always clear this browser session, even if the service is unavailable.
    } finally {
      storeAccount(null);
      setAccount(null);
      setWorkspace(null);
      setActiveWorkspaceId("");
      storeWorkspaceId(null);
      setLoadedWorkspaceKey("");
      setDeleteAccountOpen(false);
      setDeleteEmail("");
      setDeletePassword("");
      setAccountMessage("Signed out.");
      setWorkspaceName("");
      updateText("");
      updateVoiceGuidance("");
      updateProtectedTerms("");
      saveSnippets([]);
    }
  };

  const deleteMyAccount = async (event) => {
    event.preventDefault();
    if (!account || deletingAccount) return;
    setDeletingAccount(true);
    setAccountError("");
    try {
      await authenticatedRequest({
        method: "delete", url: `${API_URL}/api/auth/account/`,
        data: { email: deleteEmail, password: deletePassword },
      }, account);
      storeAccount(null);
      setAccount(null);
      setWorkspace(null);
      setActiveWorkspaceId("");
      storeWorkspaceId(null);
      setLoadedWorkspaceKey("");
      setDeleteAccountOpen(false);
      setDeleteEmail("");
      setDeletePassword("");
      setAccountPassword("");
      updateVoiceGuidance("");
      updateProtectedTerms("");
      saveSnippets([]);
      setAccountMode("register");
      setAccountMessage("Account and its workspace data were deleted. Your draft stays in this browser tab.");
    } catch (requestError) {
      const data = requestError.response?.data;
      setAccountError(data?.error || data?.email || data?.password || "Could not delete this account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const copyResult = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, text: result });
        setCopyLabel("Shared");
        setCopyStatus("Result shared.");
        window.setTimeout(() => setCopyLabel("Share result"), 1600);
        return;
      } catch (shareError) {
        if (shareError?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(result);
      setCopyLabel("Copied");
      setCopyStatus("Copied to clipboard.");
      window.setTimeout(() => setCopyLabel("Share result"), 1600);
    } catch {
      setCopyLabel("Share unavailable");
      setCopyStatus("Sharing and clipboard are unavailable. Select and copy the result manually.");
      window.setTimeout(() => setCopyLabel("Share result"), 1600);
    }
  };

  const downloadReviewPacket = () => {
    const packet = buildReviewPacket({ original: text, revised: result, reviewer: reviewerName, reviewerEmail, rationales });
    const url = URL.createObjectURL(new Blob([packet], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clear-writing-review-${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateText = (value) => {
    const nextText = [...value].slice(0, MAX_LENGTH).join("");
    setText(nextText);
    const draftSaved = persistSessionDraft(nextText);
    const previousCleared = persistSessionDraft("", PREVIOUS_DRAFT_STORAGE_KEY);
    setDraftStorageStatus(draftSaved && previousCleared ? (nextText ? "saved" : "ready") : "unavailable");
    setPreviousDraft("");
    setResult("");
    setComparisonOpen(false);
    setError("");
    setCopyStatus("");
  };

  const updateVoiceGuidance = (value) => {
    const nextValue = [...value].slice(0, MAX_VOICE_LENGTH).join("");
    setVoiceGuidance(nextValue);
    try {
      if (nextValue) sessionStorage.setItem(VOICE_STORAGE_KEY, nextValue);
      else sessionStorage.removeItem(VOICE_STORAGE_KEY);
    } catch {
      // Keep the current value usable even when browser storage is unavailable.
    }
    setResult("");
    setComparisonOpen(false);
    setError("");
  };

  const updateProtectedTerms = (value) => {
    setProtectedTermsText(value);
    try {
      if (value) sessionStorage.setItem(PROTECTED_TERMS_STORAGE_KEY, value);
      else sessionStorage.removeItem(PROTECTED_TERMS_STORAGE_KEY);
    } catch {
      // Keep current terms usable even when browser storage is unavailable.
    }
    setResult("");
    setComparisonOpen(false);
    setError("");
  };

  const updateContextBrief = (field, value) => {
    setContextBrief((current) => ({ ...current, [field]: value.slice(0, MAX_CONTEXT_FIELD_LENGTH) }));
    setResult("");
    setComparisonOpen(false);
    setError("");
  };

  const saveSnippets = (nextSnippets) => {
    setSnippets(nextSnippets);
    try {
      sessionStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(nextSnippets));
    } catch {
      // Snippets remain available for this render if browser storage is unavailable.
    }
  };

  const addSnippet = (event) => {
    event.preventDefault();
    const value = snippetDraft.trim().slice(0, MAX_SNIPPET_LENGTH);
    if (!value || snippets.length >= 8) return;
    if (snippets.some((snippet) => snippet.text === value)) return;
    saveSnippets([...snippets, { id: value, text: value }]);
    setSnippetDraft("");
  };

  const insertSnippet = (value) => {
    const start = textareaRef.current?.selectionStart ?? text.length;
    const end = textareaRef.current?.selectionEnd ?? text.length;
    const available = MAX_LENGTH - [...text].length + (end - start);
    const inserted = [...value].slice(0, available).join("");
    const nextText = `${text.slice(0, start)}${inserted}${text.slice(end)}`;
    updateText(nextText);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  };

  const updateMode = (value) => {
    setMode(value);
    if (value !== "rewrite") setExplainChanges(false);
    setResult("");
    setRationales([]);
    setComparisonOpen(false);
    setError("");
  };

  const updateExplainChanges = (value) => {
    setExplainChanges(value);
    setResult("");
    setRationales([]);
    setComparisonOpen(false);
    setError("");
  };

  const focusOriginalSentence = (change) => {
    const editor = textareaRef.current;
    if (!editor) return;
    editor.focus();
    editor.setSelectionRange(change.source_start, change.source_start + change.original.length);
  };

  const updateStyle = (value) => {
    setStyle(value);
    setResult("");
    setComparisonOpen(false);
    setError("");
  };

  const updateFormat = (value) => {
    setFormat(value);
    setResult("");
    setComparisonOpen(false);
    setError("");
  };

  const useResultAsDraft = () => {
    const nextText = [...result].slice(0, MAX_LENGTH).join("");
    setPreviousDraft(text);
    const previousSaved = persistSessionDraft(text, PREVIOUS_DRAFT_STORAGE_KEY);
    setText(nextText);
    const draftSaved = persistSessionDraft(nextText);
    setDraftStorageStatus(previousSaved && draftSaved ? "saved" : "unavailable");
    setResult("");
    setComparisonOpen(false);
    setError("");
    setCopyStatus("");
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textareaRef.current?.focus({ preventScroll: true });
  };

  const restorePreviousDraft = () => {
    updateText(previousDraft);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const downloadResult = () => {
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "clear-writing-result.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCopyStatus("Text file download started.");
  };

  const handleEditorKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const openWorkspaceSignup = () => {
    if (!ACCOUNTS_ENABLED || !accountPanelRef.current) return;
    if (!account) setAccountMode("register");
    accountPanelRef.current.open = true;
    accountPanelRef.current.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Clear writing home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>Clear writing</span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="/tools/clear-copy-check.html">Free tools</a>
          <a href="#workspace">Writing studio</a>
          <a href="#answers">Answers</a>
          <a href="/privacy.html">Privacy</a>
        </nav>
      </header>

      <section className="marketing-hero" id="top" aria-labelledby="hero-title">
        <div className="marketing-copy">
          <p className="eyebrow">Clear writing for small teams</p>
          <h1 id="hero-title">Say it clearly.<br /><em>Stay in your voice.</em></h1>
          <p className="intro-copy">Turn rough drafts into clear messages and long notes into useful summaries, with voice guidance your team controls.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#workspace">Try the writing studio <span aria-hidden="true">↘</span></a>
            {ACCOUNTS_ENABLED
              ? <button className="quiet-button" type="button" onClick={openWorkspaceSignup}>{account ? "Open your workspace" : "Create a team workspace"}</button>
              : <p className="team-access-note" role="status">Team workspaces are not enabled on this live demo yet.</p>}
          </div>
          <p className="marketing-privacy">Your draft is sent to Google Gemini only after you choose Rewrite or Summarise and confirm.</p>
        </div>
        <aside className="hero-note" aria-label="Writing approach">
          <span className="hero-note-mark" aria-hidden="true">“</span>
          <p>Keep the meaning.<br />Make the next step clear.</p>
          <span>Review every result before sharing.</span>
        </aside>
      </section>

      <section className="workflow-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="workflow-heading">
          <h2 id="workflow-title">A simple flow from rough note to ready-to-review.</h2>
          <p>Use it for a quick rewrite or a longer summary. Your team can save shared voice guidance and phrases in a workspace.</p>
        </div>
        <ol className="workflow-steps">
          <li><span>01</span><strong>Bring a draft</strong><p>Start with your own words or a sample.</p></li>
          <li><span>02</span><strong>Choose the direction</strong><p>Rewrite or summarise in a clear, warm, direct or formal tone.</p></li>
          <li><span>03</span><strong>Review and share</strong><p>Edit the result, compare it with your original, then copy or download it.</p></li>
        </ol>
      </section>

      <section className="answers-section" id="answers" aria-labelledby="answers-title">
        <div className="workflow-heading">
          <p className="eyebrow">Before you try it</p>
          <h2 id="answers-title">Clear answers about your drafts.</h2>
        </div>
        <div className="answer-list">
          <details>
            <summary>Does Clear Writing send emails for me?</summary>
            <p>No customer email is sent for you; that format only creates a draft to review, copy, and send yourself. A separate one-time getting-started email is optional and off by default.</p>
          </details>
          <details>
            <summary>What happens to the text I enter?</summary>
            <p>Your draft stays in this browser tab. It is sent to Google Gemini only after you choose Rewrite or Summarise and confirm processing. Don’t enter sensitive or confidential details.</p>
          </details>
          <details>
            <summary>Can my team share writing preferences?</summary>
            <p>Shared voice guidance and saved phrases are available in workspaces when team accounts are enabled. They are not enabled on the current live demo.</p>
          </details>
          <details>
            <summary>Can I use a result without checking it?</summary>
            <p>No. Review names, facts, tone, and commitments before sharing. Clear Writing helps with wording; you remain responsible for the final message.</p>
          </details>
          <details>
            <summary>Can I subscribe on this demo?</summary>
            <p>No. Paid accounts and subscriptions are not enabled here, and this demo does not take payments.</p>
          </details>
        </div>
      </section>

      <section className="workspace" id="workspace" aria-label="Writing workspace">
        <div className="editor-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">01 / Your draft</p>
              <h2>Start with what you have</h2>
            </div>
            {text ? (
              <button className="quiet-button" type="button" disabled={loading} onClick={() => updateText("")}>
                Clear draft
              </button>
            ) : (
              <span className="limit-chip">Up to 5,000 characters</span>
            )}
          </div>

          {ACCOUNTS_ENABLED && <details ref={accountPanelRef} className="account-settings">
            <summary>{account ? `Workspace · ${account.email}` : "Create an account to save team settings online"}</summary>
            {account ? (
              <div className="account-connected">
                {workspace?.workspaces?.length > 1 && <label className="workspace-switcher">Workspace
                  <select value={workspace.id} onChange={(event) => {
                    const nextId = Number(event.target.value);
                    setActiveWorkspaceId(nextId);
                    storeWorkspaceId(nextId);
                  }}>
                    {workspace.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>}
                <p><strong>{workspace?.name || "Your workspace"}</strong><span>{workspace?.role || "Member"}</span></p>
                {inviteToken && <div className="invite-accept"><p>You’ve been invited to join a Clear Writing workspace.</p><button className="primary-button" type="button" onClick={acceptWorkspaceInvitation}>Accept invitation</button></div>}
                {workspace?.usage && <div className="usage-meter"><span>This month: {workspace.usage.used} / {workspace.usage.limit} AI requests</span><progress max={workspace.usage.limit} value={workspace.usage.used} aria-label="Monthly AI requests used" /></div>}
                <form className="email-preferences" onSubmit={saveEmailPreferences}>
                  <label className="email-opt-in">
                    <input type="checkbox" checked={workspaceLoading ? false : onboardingEmailsOptIn} disabled={workspaceLoading || emailPreferenceSaving} onChange={(event) => setOnboardingEmailsOptIn(event.target.checked)} />
                    <span><strong>One optional getting-started email</strong><small>Only if you opt in. Turn it off here anytime; no recurring marketing emails.</small></span>
                  </label>
                  <button className="quiet-button" type="submit" disabled={workspaceLoading || emailPreferenceSaving}>{emailPreferenceSaving ? "Saving…" : "Save email preference"}</button>
                </form>
                {workspace?.billing?.enabled && workspace?.role === "owner" && <div className="billing-panel">
                  <p><strong>{workspace.billing.plan === "team" ? "Team" : "Free"} plan</strong><span>{workspace.billing.status}{workspace.billing.current_period_end ? ` · renews ${new Date(workspace.billing.current_period_end).toLocaleDateString()}` : ""}</span></p>
                  <div className="account-actions">
                    {workspace.billing.has_customer
                      ? <button className="quiet-button" type="button" disabled={billingUpdating || workspaceLoading} onClick={() => openBillingPage("portal")}>{billingUpdating ? "Opening…" : "Manage subscription"}</button>
                      : <button className="primary-button" type="button" disabled={billingUpdating || workspaceLoading} onClick={() => openBillingPage("checkout")}>{billingUpdating ? "Opening…" : "See Team plan"}</button>}
                  </div>
                </div>}
                {workspace?.role === "owner" && <div className="workspace-invitations">
                  <div className="team-list"><p>Workspace team</p>
                    {teamMembers.map((member) => <div className="team-member" key={member.user_id}>
                      <span>{member.email}{member.email === account.email ? " (you)" : ""}<small>{member.role}</small></span>
                      {member.role === "member" && <div>
                        <button className="quiet-button" type="button" disabled={teamUpdating || workspaceLoading} onClick={() => updateTeamMember(member, "transfer")}>Make owner</button>
                        <button className="quiet-button" type="button" disabled={teamUpdating || workspaceLoading} onClick={() => updateTeamMember(member, "remove")}>Remove</button>
                      </div>}
                    </div>)}
                  </div>
                  <form className="invite-form" onSubmit={sendWorkspaceInvitation}>
                    <label htmlFor="invite-email">Invite a teammate</label>
                    <div><input id="invite-email" type="email" maxLength={254} required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" /><button className="quiet-button" type="submit" disabled={inviting || workspaceLoading}>{inviting ? "Sending…" : "Send invite"}</button></div>
                  </form>
                  {invitations.map((item) => <p className="pending-invitation" key={item.id}><span>{item.email} · expires {new Date(item.expires_at).toLocaleDateString()}</span><button className="quiet-button" type="button" onClick={() => revokeInvitation(item.id)}>Revoke</button></p>)}
                </div>}
                <div className="account-actions">
                  {workspace?.role === "owner" && <button className="primary-button" type="button" disabled={loading || workspaceLoading} onClick={saveWorkspaceSettings}>Save team settings</button>}
                  <button className="quiet-button" type="button" disabled={loading} onClick={signOut}>Sign out</button>
                  <button className="quiet-button delete-account-toggle" type="button" disabled={loading || deletingAccount} onClick={() => setDeleteAccountOpen((open) => !open)}>Delete account</button>
                </div>
                {deleteAccountOpen && <form className="account-delete-form" onSubmit={deleteMyAccount}>
                  <p>This deletes your login, memberships, and sent invitations. A workspace you own is deleted only when it is empty; transfer ownership or remove other members first. Shared team settings and usage remain with the team. Your draft stays in this tab.</p>
                  <label htmlFor="delete-account-email">Confirm account email</label>
                  <input id="delete-account-email" type="email" autoComplete="username" required value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} />
                  <label htmlFor="delete-account-password">Confirm password</label>
                  <input id="delete-account-password" type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
                  <div><button className="danger-button" type="submit" disabled={deletingAccount}>{deletingAccount ? "Deleting…" : "Delete account and workspace data"}</button><button className="quiet-button" type="button" disabled={deletingAccount} onClick={() => setDeleteAccountOpen(false)}>Cancel</button></div>
                </form>}
              </div>
            ) : (
              <form className="account-form" onSubmit={submitAccount}>
                {["register", "login"].includes(accountMode) ? (
                  <div className="account-mode" role="group" aria-label="Choose account action">
                    <button type="button" aria-pressed={accountMode === "register"} onClick={() => setAccountMode("register")}>Create workspace</button>
                    <button type="button" aria-pressed={accountMode === "login"} onClick={() => setAccountMode("login")}>Sign in</button>
                  </div>
                ) : (
                  <button className="quiet-button account-back" type="button" onClick={() => setAccountMode("login")}>Back to sign in</button>
                )}
                {accountMode !== "reset-password" && <>
                  <label htmlFor="account-email">Work email</label>
                  <input id="account-email" type="email" autoComplete="username" maxLength={254} required value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
                </>}
                {accountMode === "register" && !inviteToken && (
                  <>
                    <label htmlFor="workspace-name">Workspace name</label>
                    <input id="workspace-name" maxLength={80} required value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Your team or company" />
                  </>
                )}
                {["register", "login", "reset-password"].includes(accountMode) && <>
                  <label htmlFor="account-password">{accountMode === "reset-password" ? "New password" : "Password"}</label>
                  <input id="account-password" type="password" autoComplete={accountMode === "login" ? "current-password" : "new-password"} minLength={12} maxLength={128} required value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
                </>}
                {accountMode === "register" && <label className="email-opt-in signup-email-opt-in">
                  <input type="checkbox" checked={onboardingEmailsOptIn} onChange={(event) => setOnboardingEmailsOptIn(event.target.checked)} />
                  <span><strong>Optional: send me one getting-started email</strong><small>Only after I verify my email. No recurring marketing emails; I can turn it off later in account settings.</small></span>
                </label>}
                <button className="primary-button" type="submit" disabled={!API_URL}>
                  {accountMode === "register" ? "Create workspace" : accountMode === "login" ? "Sign in" : accountMode === "reset-request" ? "Send reset link" : "Update password"}
                </button>
                {accountMode === "login" && <button className="quiet-button account-back" type="button" onClick={() => setAccountMode("reset-request")}>Forgot password?</button>}
                {accountMode === "login" && verificationPending && <button className="quiet-button account-back" type="button" onClick={resendVerification}>Resend verification email</button>}
                {accountMode === "register" && <p className="account-note">You’ll verify your email before you can sign in. Submitted drafts are not saved to the workspace.</p>}
              </form>
            )}
            {accountMessage && <p className="account-message" role="status">{accountMessage}</p>}
            {accountError && <p className="error-message" role="alert">{accountError}</p>}
          </details>}

          <label className="field-label" htmlFor="source-text">Text to work on</label>
          <textarea
            id="source-text"
            ref={textareaRef}
            disabled={loading}
            placeholder="Paste a note, message or paragraph…"
            value={text}
            onChange={(event) => updateText(event.target.value)}
            onKeyDown={handleEditorKeyDown}
            aria-describedby="privacy-note character-count keyboard-hint"
          />
          <div className="editor-meta">
            <span>{wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}</span>
            <span id="character-count">{characterCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters</span>
            <span className={`draft-storage-status${draftStorageStatus === "unavailable" ? " is-unavailable" : ""}`}>
              {draftStorageStatus === "unavailable" ? "Autosave unavailable · keep this tab open" : text ? "Saved in this tab" : "Autosaves in this tab"}
            </span>
            <span id="keyboard-hint">⌘ / Ctrl + Enter to run</span>
          </div>

          {!text && (
            <div className="sample-row" aria-label="Sample drafts">
              <span>Try a sample</span>
              {sampleDrafts.map((sample) => (
                <button key={sample.label} type="button" onClick={() => { updateFormat(sample.format); updateText(sample.text); }}>
                  {sample.label}
                </button>
              ))}
            </div>
          )}

          <details className="team-writing-settings">
            <summary>Team voice &amp; reusable phrases <span>{account ? workspace?.role === "owner" ? "Managed for this workspace" : "Managed by the workspace owner" : "Optional · kept in this tab"}</span></summary>
            <label className="field-label" htmlFor="team-voice">Voice guidance</label>
            <textarea
              className="voice-guidance"
              id="team-voice"
              maxLength={MAX_VOICE_LENGTH}
              value={voiceGuidance}
              disabled={loading || Boolean(account && workspace?.role !== "owner")}
              placeholder="For example: Use plain English, avoid hype, and end with a clear next step."
              onChange={(event) => updateVoiceGuidance(event.target.value)}
              aria-describedby="team-voice-note"
            />
            <div className="editor-meta"><span id="team-voice-note">Sent to Gemini with your draft after consent.</span><span>{voiceGuidance.length} / {MAX_VOICE_LENGTH}</span></div>
            <label className="field-label protected-terms-label" htmlFor="protected-terms">Protected product terms <span>One per line · up to {MAX_PROTECTED_TERMS}</span></label>
            <textarea
              className="voice-guidance protected-terms"
              id="protected-terms"
              maxLength={MAX_PROTECTED_TERMS * (MAX_PROTECTED_TERM_LENGTH + 1)}
              value={protectedTermsText}
              disabled={loading || Boolean(account && workspace?.role !== "owner")}
              placeholder={"Acme Cloud\nNorthstar API"}
              onChange={(event) => updateProtectedTerms(event.target.value)}
              aria-describedby="protected-terms-note"
            />
            <div className="editor-meta"><span id="protected-terms-note">If a term appears in your draft and changes, the result is rejected. Owners must save workspace settings first. Terms go to Gemini only after you approve processing.</span><span>{protectedTermsText.split(/\r?\n/).filter((term) => term.trim()).length} / {MAX_PROTECTED_TERMS}</span></div>
            <div className="snippet-heading"><span className="field-label">Reusable phrases</span><span>{snippets.length} / 8</span></div>
            {snippets.length > 0 && (
              <div className="sample-row saved-snippets" aria-label="Saved reusable phrases">
                {snippets.map((snippet) => (
                  <span className="snippet-item" key={snippet.id}>
                    <button type="button" disabled={loading || text.length >= MAX_LENGTH} onClick={() => insertSnippet(snippet.text)} title="Insert at the cursor">{snippet.text}</button>
                    <button className="snippet-remove" type="button" disabled={loading || Boolean(account && workspace?.role !== "owner")} aria-label={`Remove phrase ${snippet.text.slice(0, 40)}`} onClick={() => saveSnippets(snippets.filter((item) => item.id !== snippet.id))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <form className="snippet-form" onSubmit={addSnippet}>
              <label className="visually-hidden" htmlFor="new-snippet">New reusable phrase</label>
              <input id="new-snippet" value={snippetDraft} maxLength={MAX_SNIPPET_LENGTH} disabled={loading || (account && workspace?.role !== "owner") || snippets.length >= 8} placeholder="Add a phrase your team uses…" onChange={(event) => setSnippetDraft(event.target.value)} />
              <button className="quiet-button" type="submit" disabled={loading || (account && workspace?.role !== "owner") || !snippetDraft.trim() || snippets.length >= 8}>Save phrase</button>
            </form>
            {account && workspace?.role === "owner" && (
              <section className="style-guide-history" aria-labelledby="style-guide-history-title">
                <div className="snippet-heading"><span id="style-guide-history-title" className="field-label">Recent style guide versions</span><span>Up to 10 shown · 20 kept</span></div>
                {workspaceLoading ? <p className="editor-meta">Loading saved versions…</p> : workspace?.style_guide_versions?.length ? (
                  <ul className="style-version-list">
                    {workspace.style_guide_versions.map((version) => (
                      <li key={version.id}>
                        <div><strong>{new Date(version.created_at).toLocaleString()}</strong><span>{version.snippets.length} reusable {version.snippets.length === 1 ? "phrase" : "phrases"} · {version.action === "before_restore" ? "Before restore" : "Before edit"}</span></div>
                        <button className="quiet-button" type="button" disabled={loading || workspaceLoading} onClick={() => restoreStyleGuideVersion(version.id)}>Restore</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="editor-meta">Saved versions appear after the team voice or reusable phrases change.</p>}
              </section>
            )}
          </details>

          <details className="team-writing-settings context-brief">
            <summary>Add a context brief <span>Optional · for this request only</span></summary>
            <label className="field-label" htmlFor="context-reader">Who will read this?</label>
            <input className="voice-guidance" id="context-reader" maxLength={MAX_CONTEXT_FIELD_LENGTH} value={contextBrief.reader} onChange={(event) => updateContextBrief("reader", event.target.value)} placeholder="For example: a customer" />
            <label className="field-label" htmlFor="context-goal">What should the message do?</label>
            <input className="voice-guidance" id="context-goal" maxLength={MAX_CONTEXT_FIELD_LENGTH} value={contextBrief.goal} onChange={(event) => updateContextBrief("goal", event.target.value)} placeholder="For example: confirm the next step" />
            <label className="field-label" htmlFor="context-must-keep">Facts to keep</label>
            <textarea className="voice-guidance" id="context-must-keep" maxLength={MAX_CONTEXT_FIELD_LENGTH} value={contextBrief.must_keep} onChange={(event) => updateContextBrief("must_keep", event.target.value)} placeholder="Only include facts already present in your draft." />
            <label className="field-label" htmlFor="context-avoid">Things to avoid</label>
            <textarea className="voice-guidance" id="context-avoid" maxLength={MAX_CONTEXT_FIELD_LENGTH} value={contextBrief.avoid} onChange={(event) => updateContextBrief("avoid", event.target.value)} placeholder="For example: jargon or overly formal wording" />
            <div className="editor-meta"><span>Kept in memory for this page only. Sent to Gemini with your draft after you approve processing.</span><span>{Object.values(contextBrief).filter(Boolean).length} / 4 fields</span></div>
          </details>

          <div className="action-row">
            <div>
              <div className="action-controls">
                <div className="mode-switch" role="group" aria-label="Choose a writing action">
                  <button type="button" disabled={loading} aria-pressed={mode === "rewrite"} onClick={() => updateMode("rewrite")}>Rewrite</button>
                  <button type="button" disabled={loading} aria-pressed={mode === "summarise"} onClick={() => updateMode("summarise")}>Summarise</button>
                </div>
                <label className="style-control">
                  <span>Output tone</span>
                  <select disabled={loading} value={style} onChange={(event) => updateStyle(event.target.value)}>
                    <option value="clear">Clear</option>
                    <option value="warm">Warm</option>
                    <option value="direct">Direct</option>
                    <option value="formal">Formal</option>
                  </select>
                </label>
                <label className="format-control">
                  <span>Output format</span>
                  <select disabled={loading} value={format} onChange={(event) => updateFormat(event.target.value)}>
                    <option value="general">General</option>
                    <option value="customer_email">Customer email draft</option>
                    <option value="internal_update">Internal update</option>
                    <option value="meeting_recap">Meeting recap</option>
                  </select>
                </label>
                {mode === "rewrite" && (
                  <label className="consent-row rationale-toggle">
                    <input type="checkbox" disabled={loading} checked={explainChanges} onChange={(event) => updateExplainChanges(event.target.checked)} />
                    <span>Explain key changes</span>
                  </label>
                )}
              </div>
              <p className="mode-hint">
                {format === "customer_email" ? "Draft only. Nothing is sent." : mode === "rewrite" ? "Keep the idea. Make the wording clearer." : "Keep the key points. Leave out the extra detail."}
              </p>
            </div>
            <button
              className={`primary-button${loading ? " is-loading" : ""}`}
              type="button"
              onClick={submit}
              disabled={!API_URL || loading || workspaceLoading || !text.trim() || characterCount > MAX_LENGTH || !adultConfirmed || !processingConfirmed}
            >
              {loading ? "Working…" : mode === "rewrite" ? "Rewrite text" : "Create summary"}
              {!loading && <span aria-hidden="true">↗</span>}
            </button>
          </div>

          {!API_URL && <p className="service-note" role="status">The writing service is unavailable right now. Please try again later.</p>}
          <p className="submit-hint" aria-live="polite">
            {!adultConfirmed ? "Confirm you’re 18 or older to continue." : !processingConfirmed ? "Agree to send the draft to Gemini before continuing." : "Your draft is sent only when you choose Rewrite or Summarise."}
          </p>
          <p className="privacy-note" id="privacy-note">
            Your draft stays in this browser tab. {account ? "Signed-in workspace voice guidance, protected terms, and saved phrases are stored in your workspace." : "Unsynced voice guidance, protected terms, and saved phrases stay in this browser tab."} When you choose an action, the draft, optional context brief, protected terms, and workspace voice guidance are sent to Google Gemini after you confirm processing; a saved phrase is included only if you insert it into the draft. Don’t include sensitive, confidential, or personal details. On unpaid API use, Google may use prompts and responses to improve its services and human reviewers may process them. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Read Gemini’s terms</a>.
          </p>
          <label className="consent-row">
            <input type="checkbox" disabled={loading} checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} />
            <span>I confirm I’m 18 or older.</span>
          </label>
          <label className="consent-row">
            <input type="checkbox" disabled={loading} checked={processingConfirmed} onChange={(event) => setProcessingConfirmed(event.target.checked)} />
            <span>I agree to send this text to Google Gemini for processing.</span>
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
        </div>

        <section className="result-panel" aria-labelledby="result-heading" aria-busy={loading}>
          <div className="panel-heading result-heading">
            <div>
              <p className="eyebrow">02 / Review</p>
              <h2 id="result-heading">Your result</h2>
            </div>
          </div>
          <div className={`result-body${result ? " has-result" : ""}`} aria-live="polite">
            {result ? (
              comparisonOpen ? (
                <div className="comparison-view" id="draft-comparison" aria-label="Compare your draft with the result">
                  <article><h3>Original · {wordCount.toLocaleString()} words</h3><p>{text}</p></article>
                  <article><h3>{mode === "rewrite" ? "Rewrite" : "Summary"} · {result.trim().split(/\s+/).length.toLocaleString()} words</h3><p>{result}</p></article>
                </div>
              ) : (
                <div className="result-content">
                  <p>{result}</p>
                  {rationales.length > 0 && (
                    <section className="change-rationales" aria-labelledby="change-rationales-title">
                      <div className="rationale-heading"><h3 id="change-rationales-title">Why these sentences changed</h3><span>AI explanation · review for accuracy</span></div>
                      {rationales.map((change, index) => (
                        <article className="rationale-card" key={`${change.source_start}-${change.result_start}`}>
                          <div className="rationale-card-heading"><h4>Change {index + 1}</h4><button className="quiet-button" type="button" onClick={() => focusOriginalSentence(change)}>Select original</button></div>
                          <p><strong>Before</strong><span>{change.original}</span></p>
                          <p><strong>After</strong><span>{change.revised}</span></p>
                          <p><strong>Reason</strong><span>{change.reason}</span></p>
                        </article>
                      ))}
                    </section>
                  )}
                </div>
              )
            ) : (
              <div className="empty-state">
                <span className="empty-mark" aria-hidden="true">Aa</span>
                <h3>{loading ? "Finding a clearer version" : "Your words, with room to breathe"}</h3>
                <p>{loading ? "This usually takes a few seconds." : "Your rewrite or summary will appear here."}</p>
              </div>
            )}
          </div>
          {(result || previousDraft) && (
            <div className="result-actions">
              {previousDraft && <button className="quiet-button" type="button" onClick={restorePreviousDraft}>Restore previous draft</button>}
              {result && (
                <>
                  <button className="quiet-button" type="button" aria-expanded={comparisonOpen} onClick={() => setComparisonOpen((open) => !open)}>{comparisonOpen ? "Back to result" : "Compare with draft"}</button>
                  <button className="quiet-button" type="button" onClick={useResultAsDraft}>Use as next draft</button>
                  <button className="quiet-button" type="button" onClick={downloadResult}>Download .txt</button>
                  <button className="quiet-button" type="button" aria-expanded={reviewPacketOpen} onClick={() => setReviewPacketOpen((open) => !open)}>Prepare review packet</button>
                  <button className="copy-button" type="button" onClick={copyResult}>{copyLabel}</button>
                </>
              )}
            </div>
          )}
          {reviewPacketOpen && result && (
            <section className="review-packet-panel" aria-labelledby="review-packet-title">
              <h3 id="review-packet-title">Share a review copy</h3>
              <p>The HTML file is created on this device. It is not uploaded or emailed; your reviewer can mark a decision and save the response as PDF.</p>
              <div className="review-packet-fields">
                <label>Reviewer name <input value={reviewerName} maxLength={120} onChange={(event) => setReviewerName(event.target.value)} /></label>
                <label>Reviewer email <input type="email" value={reviewerEmail} maxLength={254} onChange={(event) => setReviewerEmail(event.target.value)} /></label>
              </div>
              <button className="copy-button" type="button" onClick={downloadReviewPacket}>Download review packet</button>
            </section>
          )}
          <span className="visually-hidden" role="status" aria-live="polite">{copyStatus}</span>
          <div className="result-footer">
            <span>AI-generated. Check that it still says what you mean.</span>
            <span>Draft stays in this tab only.</span>
          </div>
        </section>
      </section>

      <footer className="page-footer">
        <span>Clear writing, one pass at a time.</span>
        <span>18+ · Professional use · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></span>
      </footer>
    </main>
  );
}

export default App;
