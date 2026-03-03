import {
  getAdminProfile,
  getResidentProfile,
  getStaffProfile,
} from "../core/data.mjs";
import {
  forbiddenForRole,
  requireSession,
} from "./session.mjs";

export async function requireResidentSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "resident") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const residentProfile = await getResidentProfile(db, session.accountId);
  if (!residentProfile) {
    return {
      response: forbiddenForRole(session, "Resident profile is missing."),
    };
  }

  return {
    session,
    residentProfile,
  };
}

export async function requireAdminSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "admin") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const adminProfile = await getAdminProfile(db, session.accountId);
  if (!adminProfile) {
    return {
      response: forbiddenForRole(session, "Admin profile is missing."),
    };
  }

  return {
    session,
    adminProfile,
  };
}

export async function requireStaffSession({ db, request, environment }) {
  const authResult = await requireSession({ db, request, environment });
  if (authResult.response) {
    return authResult;
  }

  const { session } = authResult;
  if (session.role !== "staff") {
    return {
      response: forbiddenForRole(session),
    };
  }

  const staffProfile = await getStaffProfile(db, session.accountId);
  if (!staffProfile) {
    return {
      response: forbiddenForRole(session, "Staff profile is missing."),
    };
  }

  return {
    session,
    staffProfile,
  };
}
