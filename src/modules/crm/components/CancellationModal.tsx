import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchCancellationReasons } from '../service';
import type { CrmCancellationReason } from '../types';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    orgId: string;
}

export function CancellationModal({ isOpen, onClose, onConfirm, orgId }: CancellationModalProps) {
    const [reasons, setReasons] = useState<CrmCancellationReason[]>([]);
    const [selectedReason, setSelectedReason] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && orgId) {
            loadReasons();
        }
    }, [isOpen, orgId]);

    const loadReasons = async () => {
        setLoading(true);
        try {
            const data = await fetchCancellationReasons(orgId);
            setReasons(data);
        } catch (error) {
            console.error('Error loading cancellation reasons:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900">Cancelar Venda</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                        Selecione o motivo principal para o cancelamento ou recusa desta venda. Esta ação é irreversível e será registrada no histórico.
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Motivo do Cancelamento</label>
                            {loading ? (
                                <div className="h-12 bg-gray-50 rounded-xl animate-pulse flex items-center px-4">
                                    <span className="text-xs text-gray-400">Carregando motivos...</span>
                                </div>
                            ) : (
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand/10 focus:border-brand focus:outline-none transition-all"
                                    value={selectedReason}
                                    onChange={e => setSelectedReason(e.target.value)}
                                >
                                    <option value="">Selecione um motivo...</option>
                                    {reasons.map(r => (
                                        <option key={r.id} value={r.label}>{r.label}</option>
                                    ))}
                                    <option value="Outros">Outros</option>
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-6 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        Voltar
                    </button>
                    <button
                        onClick={() => selectedReason && onConfirm(selectedReason)}
                        disabled={!selectedReason}
                        className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-red-100"
                    >
                        Confirmar Cancelamento
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
