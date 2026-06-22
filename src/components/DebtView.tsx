/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BookOpen, UserPlus, Search, Phone, DollarSign, Calendar, Eye, CreditCard, ArrowDownRight, BadgeAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { Debt, DebtPayment } from '../types';
import { formatRupiah, formatDate } from '../utils/format';

interface DebtViewProps {
  debts: Debt[];
  onAddDebtProfile: (customerName: string, phone: string, amount: number, notes: string) => void;
  onRecordDebtPayment: (debtId: string, amount: number) => void;
  onDeleteDebtProfile: (debtId: string) => void;
}

export default function DebtView({
  debts,
  onAddDebtProfile,
  onRecordDebtPayment,
  onDeleteDebtProfile
}: DebtViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Belum Lunas' | 'Lunas'>('Belum Lunas'); // default show outstanding

  // Active modal details
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentError, setPaymentError] = useState('');
  
  // Custom alerts and confirmations
  const [deleteConf, setDeleteConf] = useState<{ debtId: string, customerName: string } | null>(null);
  const [waCopySuccess, setWaCopySuccess] = useState<string | null>(null);
  
  // Create debt states
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // Filtering
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      const matchSearch = d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || d.phone.includes(searchQuery);
      
      let matchStatus = true;
      if (filterStatus === 'Belum Lunas') matchStatus = d.remainingDebt > 0;
      else if (filterStatus === 'Lunas') matchStatus = d.remainingDebt <= 0;

      return matchSearch && matchStatus;
    });
  }, [debts, searchQuery, filterStatus]);

  // Overall statistics
  const totalDebtStats = useMemo(() => {
    const activeDebts = debts.filter(d => d.remainingDebt > 0);
    const sum = activeDebts.reduce((acc, d) => acc + d.remainingDebt, 0);
    return {
      totalOutstanding: sum,
      peopleCount: activeDebts.length
    };
  }, [debts]);

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    onAddDebtProfile(
      formName.trim(),
      formPhone.trim(),
      Number(formAmount),
      formNotes.trim()
    );

    // reset
    setFormName('');
    setFormPhone('');
    setFormAmount(0);
    setFormNotes('');
    setShowAddDebtModal(false);
  };

  const handleOpenInstallment = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount(debt.remainingDebt); // set total outstanding as default input
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const handleSaveInstallment = () => {
    if (!selectedDebt || paymentAmount <= 0) return;
    
    // limit payment amount to preventing overpaying
    if (paymentAmount > selectedDebt.remainingDebt) {
      setPaymentError("Jumlah pembayaran melebihi sisa utang!");
      return;
    }

    onRecordDebtPayment(selectedDebt.id, paymentAmount);
    
    // Dynamically project local updated state to trigger instantaneous UI refresh!
    const nextRemaining = Math.max(0, selectedDebt.remainingDebt - paymentAmount);
    const newPaymentObj: DebtPayment = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString(),
      amount: paymentAmount
    };
    
    const updated: Debt = {
      ...selectedDebt,
      remainingDebt: nextRemaining,
      status: nextRemaining <= 0 ? 'Lunas' : 'Belum Lunas',
      payments: [newPaymentObj, ...(selectedDebt.payments || [])]
    };
    
    setSelectedDebt(updated);
    setShowPaymentModal(false);
  };

  const handleDeleteProfile = (debtId: string, customerName: string) => {
    setDeleteConf({ debtId, customerName });
  };

  return (
    <div id="debt-view-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      
      {/* LEFT COLUMN: Customer Debt List */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        
        {/* Statistics & Filter Area */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block">Total Piutang Belum Lunas</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-display font-mono font-bold text-2xl text-rose-600">
                  {formatRupiah(totalDebtStats.totalOutstanding)}
                </span>
                <span className="text-xs font-medium text-slate-500">diutang oleh {totalDebtStats.peopleCount} Tetangga</span>
              </div>
            </div>

            <button
              onClick={() => setShowAddDebtModal(true)}
              className="py-2.5 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-md shadow-emerald-100/50 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Catat Utang Baru</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search customer Name */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari pelanggan berdasarkan nama atau telepon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            {/* Filter Outstanding vs Settled */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-start">
              <button
                onClick={() => setFilterStatus('Belum Lunas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'Belum Lunas' ? 'bg-white text-rose-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                Belum Lunas ({debts.filter(d => d.remainingDebt > 0).length})
              </button>
              <button
                onClick={() => setFilterStatus('Lunas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'Lunas' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-505'
                }`}
              >
                Sudah Lunas ({debts.filter(d => d.remainingDebt <= 0).length})
              </button>
              <button
                onClick={() => setFilterStatus('Semua')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'Semua' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                Semua ({debts.length})
              </button>
            </div>
          </div>

        </div>

        {/* List of customer debts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-y-auto max-h-[60vh] pr-1">
          {filteredDebts.map(debt => {
            const isSettled = debt.remainingDebt <= 0;

            return (
              <div
                key={debt.id}
                id={`debt-card-${debt.id}`}
                onClick={() => setSelectedDebt(debt)}
                className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                  selectedDebt?.id === debt.id
                    ? 'border-indigo-650 bg-indigo-50/10 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{debt.customerName}</h4>
                      {debt.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{debt.phone}</span>
                        </div>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      isSettled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800 animate-pulse'
                    }`}>
                      {isSettled ? 'Selesai' : 'Kasbon'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic font-medium">"{debt.notes}"</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Sisa Tagihan</span>
                    <span className={`font-mono text-sm font-bold ${isSettled ? 'text-slate-400 line-through' : 'text-rose-600'}`}>
                      {formatRupiah(debt.remainingDebt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDebt(debt);
                      }}
                      className="p-1 px-2 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-550 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Rincian</span>
                    </button>

                    {!isSettled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInstallment(debt);
                        }}
                        className="py-1 px-2.5 bg-rose-50 hover:bg-rose-105 hover:text-rose-700 text-rose-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Cicil</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDebts.length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-slate-205 rounded-2xl py-12 text-center text-slate-400">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">Buku utang kosong</p>
              <p className="text-xs text-slate-400 mt-1">Tidak ada catatan utang yang sesuai filter diatas</p>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Customer Ledger Details & History (Dynamic Drawer) */}
      <div className="lg:col-span-4 flex flex-col bg-white border border-slate-100 rounded-2xl shadow-sm h-full min-h-[400px]">
        {selectedDebt ? (
          <div className="p-4 flex flex-col gap-4 h-full">
            
            {/* Header Details */}
            <div className="flex justify-between items-start border-b border-indigo-50 pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-sm uppercase">{selectedDebt.customerName}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Tgl dibuat: {new Date(selectedDebt.dateCreated).toLocaleDateString()}</span>
              </div>
              <button
                onClick={() => handleDeleteProfile(selectedDebt.id, selectedDebt.customerName)}
                className="text-[11px] text-slate-350 hover:text-rose-600 font-bold"
              >
                Hapus Buku
              </button>
            </div>

            {/* Balances card */}
            <div className="bg-rose-50/50 rounded-2xl p-3 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold text-rose-800 uppercase block">Saldo Total Utang</span>
                <span className="font-mono text-sm font-bold text-rose-700">{formatRupiah(selectedDebt.totalDebt)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-rose-800 uppercase block">Sisa Harus Bayar</span>
                <span className="font-mono text-base font-extrabold text-rose-600">{formatRupiah(selectedDebt.remainingDebt)}</span>
              </div>
            </div>

            {/* Note block */}
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[9px] text-slate-400 font-bold block mb-0.5">Catatan Belanja</span>
              <p className="text-xs text-slate-700 font-medium italic">"{selectedDebt.notes || 'Tidak ada catatan khusus'}"</p>
            </div>

            {/* Installments History */}
            <div className="flex-1 overflow-y-auto">
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-2">Riwayat Pembayaran Cicilan</span>
              <div className="flex flex-col gap-2">
                {selectedDebt.payments && selectedDebt.payments.map((p, idx) => (
                  <div key={p.id} className="p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5Col text-slate-550">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                      <div>
                        <div className="font-bold text-slate-750">Cicilan Ke-{idx + 1}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{formatDate(p.date)}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">+{formatRupiah(p.amount)}</span>
                  </div>
                ))}

                {(!selectedDebt.payments || selectedDebt.payments.length === 0) && (
                  <p className="text-[11px] text-slate-400 italic text-center py-6">Belum pernah melakukan pelunasan / cicilan.</p>
                )}
              </div>
            </div>

            {/* Footer triggers */}
            {selectedDebt.remainingDebt > 0 && (
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => handleOpenInstallment(selectedDebt)}
                  className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs font-bold rounded-xl text-center shadow-sm shadow-emerald-100/50 cursor-pointer"
                >
                  Bayar Cicilan / Lunas
                </button>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <BookOpen className="w-10 h-10 text-slate-300 mb-2" />
            <h4 className="text-xs font-bold text-slate-600">Rincian Buku Utang</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[180px]">Silakan pilih nama pembeli di sebelah kiri untuk melihat detail cicilan</p>
          </div>
        )}
      </div>

      {/* MODAL: RECORD INSTALLMENT PAYMENT */}
      {showPaymentModal && selectedDebt && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-display font-bold text-slate-800 text-sm">Pembayaran Cicilan Utang</h3>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-xs p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">NAMA PELANGGAN</p>
                <p className="font-semibold text-slate-850 text-sm">{selectedDebt.customerName}</p>
                <p className="text-xs text-slate-500 mt-1">Sisa tagihan: <span className="font-mono font-bold text-rose-600">{formatRupiah(selectedDebt.remainingDebt)}</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">Jumlah Setoran Cicilan (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentAmount === 0 ? '' : new Intl.NumberFormat('id-ID').format(paymentAmount)}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '');
                    let numericVal = cleanVal ? parseInt(cleanVal, 10) : 0;
                    if (numericVal > selectedDebt.remainingDebt) {
                      numericVal = selectedDebt.remainingDebt;
                    }
                    setPaymentError('');
                    setPaymentAmount(numericVal);
                  }}
                  className="w-full text-center text-lg font-mono font-bold px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {paymentError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-1.5 animate-pulse select-none">
                  <BadgeAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="flex gap-1.5">
                <button
                  onClick={() => setPaymentAmount(selectedDebt.remainingDebt)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-800 text-slate-700 rounded-lg text-xs font-bold transition-all"
                >
                  Bayar Lunas
                </button>
                <button
                  onClick={() => setPaymentAmount(Math.min(50000, selectedDebt.remainingDebt))}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Rp 50rb
                </button>
                <button
                  onClick={() => setPaymentAmount(Math.min(100000, selectedDebt.remainingDebt))}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Rp 100rb
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2 shrink-0">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-xs text-slate-650"
              >
                Batal
              </button>
              <button
                onClick={handleSaveInstallment}
                className="flex-1 py-2 bg-emerald-400 hover:bg-emerald-500 text-emerald-950 font-semibold rounded-xl text-xs shadow-md shadow-emerald-100"
              >
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEBT PROFILE MANUALLY */}
      {showAddDebtModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-display font-bold text-slate-800 text-sm">Catat Kasbon / Utang</h3>
              <button 
                onClick={() => setShowAddDebtModal(false)} 
                className="text-slate-400 hover:text-slate-605 font-bold text-xs p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Nama Tetangga/Pembeli (Wajib)</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Bu RT, Pak Slamet..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">No. HP / Telepon (Opsional)</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 0812xxxxxxxx"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Nilai Pinjaman Pertama (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formAmount === 0 ? '' : new Intl.NumberFormat('id-ID').format(formAmount)}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/\D/g, '');
                      const numericVal = cleanVal ? parseInt(cleanVal, 10) : 0;
                      setFormAmount(numericVal);
                    }}
                    placeholder="Masukkan jumlah..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Catatan Keperluan</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Ngutang Beras Pandan Wangi 1 Karung..."
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none font-medium"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddDebtModal(false)}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 font-semibold text-xs rounded-xl"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold text-xs rounded-xl shadow-md"
                >
                  Simpan Buku Utang
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Custom Non-blocking Delete Confirmation Modal */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in font-sans">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setDeleteConf(null)}
          />
          <div className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col items-center text-center z-10 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="p-3 bg-rose-50 rounded-full text-rose-600 mb-3">
              <BadgeAlert className="w-8 h-8 text-rose-500 animate-bounce" />
            </div>
            
            <h3 className="font-display font-black text-slate-800 text-sm sm:text-base uppercase tracking-wide">
              Hapus Buku Kasbon?
            </h3>
            
            <p className="text-xs text-slate-505 leading-relaxed mt-2 font-medium">
              Apakah Anda yakin ingin menghapus seluruh catatan buku utang atas nama <strong className="text-slate-800 text-rose-600 font-bold font-mono">"{deleteConf.customerName}"</strong>? Tindakan ini bersifat permanen dan data lama akan langsung dihapus bersih dari database cloud Anda.
            </p>

            <div className="flex gap-2.5 w-full mt-5">
              <button
                type="button"
                onClick={() => setDeleteConf(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDebtProfile(deleteConf.debtId);
                  setDeleteConf(null);
                  setSelectedDebt(null);
                }}
                className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-xl text-xs font-bold cursor-pointer items-center justify-center flex gap-1 shadow-md shadow-emerald-100/50 transition-all select-none active:scale-[0.98]"
              >
                <span>Hapus Buku</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
