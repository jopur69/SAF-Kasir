import React from 'react';

interface RegisteredUser {
  id: string;
  storeName: string;
  username: string;
  email?: string;
  password?: string;
  dateCreated?: string;
  expiryDate?: string;
  maxTransactions?: number;
  status?: 'active' | 'suspended';
}

interface FeedbackFABProps {
  currentUser: RegisteredUser;
}

export default function FeedbackFAB({ currentUser }: FeedbackFABProps) {
  // Completely removed as per user instruction "tampilan dan tulisan 'Ada saran perbaikan' dihilangkan"
  return null;
}
