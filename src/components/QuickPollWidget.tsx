import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { RegisteredUser } from './LoginPortal';
import { HelpCircle, Check, X, Award, BarChart3, RotateCcw, ThumbsUp } from 'lucide-react';

interface QuickPollWidgetProps {
  currentUser: RegisteredUser;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  status: 'Aktif' | 'Nonaktif';
  createdAt: string;
}

interface PollResponse {
  id: string;
  pollId: string;
  userId: string;
  storeName: string;
  username: string;
  selectedOption: string;
  answeredAt: string;
}

export default function QuickPollWidget({ currentUser }: QuickPollWidgetProps) {
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [myResponse, setMyResponse] = useState<PollResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMess, setErrorMess] = useState('');
  
  // Keep track of manual dismissal for the session
  const [isDismissed, setIsDismissed] = useState(false);
  // Control automatic fade-out after voting
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.id === 'default') {
      setIsLoading(false);
      return;
    }

    // 1. Listen for active polls
    const pollsQuery = query(collection(db, 'polls'), where('status', '==', 'Aktif'));
    
    const unsubscribePolls = onSnapshot(
      pollsQuery,
      (snapshot) => {
        const pollList: Poll[] = [];
        snapshot.forEach((docSnap) => {
          pollList.push(docSnap.data() as Poll);
        });
        
        // Sort by createdAt desc to show the latest active poll
        pollList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        if (pollList.length > 0) {
          const latestPoll = pollList[0];
          setActivePoll(latestPoll);
          
          // Check if this specific poll was already dismissed in the session
          const sessionDismissed = sessionStorage.getItem(`dismissed_poll_${latestPoll.id}`);
          if (sessionDismissed === 'true') {
            setIsDismissed(true);
          } else {
            setIsDismissed(false);
          }
        } else {
          setActivePoll(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to load active polls:', err);
        setIsLoading(false);
        handleFirestoreError(err, OperationType.GET, 'polls');
      }
    );

    // 2. Listen for poll responses to compile statistics
    const unsubscribeResponses = onSnapshot(
      collection(db, 'poll_responses'),
      (snapshot) => {
        const respList: PollResponse[] = [];
        snapshot.forEach((docSnap) => {
          respList.push(docSnap.data() as PollResponse);
        });
        setResponses(respList);
      },
      (err) => {
        console.error('Failed to load poll responses:', err);
        handleFirestoreError(err, OperationType.GET, 'poll_responses');
      }
    );

    return () => {
      unsubscribePolls();
      unsubscribeResponses();
    };
  }, [currentUser]);

  // Sync current user's vote status for the active poll
  useEffect(() => {
    if (activePoll && responses.length > 0) {
      const found = responses.find(r => r.pollId === activePoll.id && r.userId === currentUser.id);
      setMyResponse(found || null);
    } else {
      setMyResponse(null);
    }
  }, [activePoll, responses, currentUser]);

  if (isLoading || !activePoll || isDismissed) {
    return null;
  }

  // If user has already filled the poll, we don't display it of course!
  // Unless we are in a thank-you success fade state
  if (myResponse && !isFadingOut) {
    return null;
  }

  const handleVote = async (option: string) => {
    setIsSubmitting(true);
    setErrorMess('');
    const respId = `${currentUser.id}_${activePoll.id}`;
    
    try {
      const payload: PollResponse = {
        id: respId,
        pollId: activePoll.id,
        userId: currentUser.id,
        storeName: currentUser.storeName,
        username: currentUser.username,
        selectedOption: option,
        answeredAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'poll_responses', respId), payload);
      
      // Start elegant exit animation sequence
      setIsFadingOut(true);
      setTimeout(() => {
        setIsDismissed(true);
        // Persist session dismissal so it doesn't pop up again in the current session
        sessionStorage.setItem(`dismissed_poll_${activePoll.id}`, 'true');
      }, 2500); // 2.5 seconds thank you preview, then closes

    } catch (err: any) {
      console.error('Failed to submit vote:', err);
      setErrorMess('Gagal mengirim jawaban: ' + (err.message || 'Error'));
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsDismissed(true);
    sessionStorage.setItem(`dismissed_poll_${activePoll.id}`, 'true');
  };

  // Count response statistics
  const pollVoters = responses.filter(r => r.pollId === activePoll.id);
  const totalVotes = pollVoters.length;

  return (
    <div 
      className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 max-w-sm w-[92vw] md:w-96 bg-white rounded-2xl border border-indigo-100 shadow-2xl transition-all duration-500 ease-out transform ${
        isFadingOut ? 'scale-95 opacity-0 pointer-events-none translate-y-4' : 'scale-100 opacity-100 translate-y-0 animate-fade-in'
      }`}
    >
      {/* Decorative top colored border bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-t-2xl" />

      {/* Close button */}
      {!isFadingOut && (
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full transition-all cursor-pointer"
          title="Tutup Polling"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isFadingOut ? (
        // STATE: Answered / Success Celebration
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 shadow-sm border border-emerald-200 animate-bounce">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <h4 className="font-display font-black text-slate-800 text-[12px] tracking-widest uppercase">
            Terima Kasih!
          </h4>
          <p className="text-[13px] text-slate-600 font-bold mt-2 leading-relaxed">
            Terima kasih banyak sudah mengisi polling, Juragan! Aspirasi Anda sangat berharga untuk kami.
          </p>
        </div>
      ) : (
        // STATE: Unvoted Poll Prompt
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1 px-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-wider">
              🗳️ Polling Kilat
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Aspirasi Juragan</span>
          </div>

          <h3 className="font-display font-extrabold text-slate-800 text-sm tracking-tight mb-4 leading-snug">
            {activePoll.question}
          </h3>

          {errorMess && (
            <div className="mb-3 p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[10.5px] font-bold">
              {errorMess}
            </div>
          )}

          {/* Action Choice Buttons */}
          <div className="flex flex-col gap-2">
            {activePoll.options.map((option, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleVote(option)}
                className="w-full p-3 bg-white hover:bg-indigo-50 border border-slate-150 hover:border-indigo-300 rounded-xl text-left font-bold text-xs text-slate-700 hover:text-indigo-950 transition-all cursor-pointer active:scale-[0.98] shadow-3xs hover:shadow-2xs group flex items-center gap-2 justify-between"
              >
                <span>{option}</span>
                <div className="w-4 h-4 rounded-full border border-slate-300 group-hover:border-indigo-400 group-hover:bg-indigo-50 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-indigo-600 transition-colors" />
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Aspirasi Anda aman & anonim</span>
            <span>{totalVotes} partisipan</span>
          </div>
        </div>
      )}
    </div>
  );
}
