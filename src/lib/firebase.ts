/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable fully automatic offline local persistence cache in Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
}, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export const isFirebasePlaceholder = 
  !firebaseConfig.apiKey || 
  firebaseConfig.apiKey.includes('remixed') || 
  firebaseConfig.apiKey === '';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  // If we are offline or firebase is use placeholders, log as info/warning instead of throwing a massive error
  if (isFirebasePlaceholder || !navigator.onLine) {
    console.info('Firestore operation skipped/failed gracefully (Offline/Placeholder):', errInfo.error);
    return;
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation helper to test Connection to Firestore
async function testConnection() {
  if (isFirebasePlaceholder) {
    console.log("Firebase is configured to run in offline local-only mode.");
    return;
  }
  if (!navigator.onLine) {
    console.log("Internet offline. Firebase connection test postponed.");
    return;
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    console.warn("Firebase connection test failed/postponed.", error);
  }
}

testConnection();
