import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';

interface UserProfile {
    id: string;
    full_name: string;
    role: string;
    status: string;
    created_at: string;
    organization_id: string;
    cpf?: string;
    birth_date?: string;
    job_title_id?: string;
    department_id?: string;
    sector_id?: string;
    manager_id?: string;
    employee_id?: number;
    gender?: string;
    can_export_data?: boolean;
    // Computed fields for display
    job_titles?: { title: string };
    departments?: { name: string };
    sectors?: { name: string };
    email?: string;
    organization_role_id?: string;
}

interface OrganizationRole {
    id: string;
    name: string;
}

interface CrmStore {
    id: string;
    name: string;
}

interface Department {
    id: string;
    name: string;
}

interface Sector {
    id: string;
    name: string;
    department_id: string;
}

interface JobTitle {
    id: string;
    title: string;
    department_id?: string;
    sector_id?: string;
}

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userToEdit?: UserProfile | null;
}

export default function UserForm({ isOpen, onClose, onSuccess, userToEdit }: UserFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('user');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [jobTitleId, setJobTitleId] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [sectorId, setSectorId] = useState('');
    const [managerId, setManagerId] = useState('');
    const [managerName, setManagerName] = useState('');
    const [gender, setGender] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // New State for Multi-step Form
    const [step, setStep] = useState(1);
    const [cpfError, setCpfError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [organizationRoleId, setOrganizationRoleId] = useState('');
    const [admissionDate, setAdmissionDate] = useState('');
    const [inactivationDate, setInactivationDate] = useState('');
    const [sendWelcome, setSendWelcome] = useState(true);
    const [crmStoreId, setCrmStoreId] = useState('');

    // Additional state for managers list
    const [managers, setManagers] = useState<UserProfile[]>([]);
    const [availableDepartments, setAvailableDepartments] = useState<Department[]>([]);
    const [availableSectors, setAvailableSectors] = useState<Sector[]>([]);
    const [availableJobTitles, setAvailableJobTitles] = useState<JobTitle[]>([]);
    const [availableRoles, setAvailableRoles] = useState<OrganizationRole[]>([]);
    const [availableStores, setAvailableStores] = useState<CrmStore[]>([]);

    useEffect(() => {
        // Fetch potential managers (all users in org) and metadata
        const fetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const orgId = session.user.user_metadata.organization_id;
            if (!orgId) return;

            // Fetch Managers
            const { data: managersData } = await supabase
                .from('profiles')
                .select('id, full_name, manager_name')
                .eq('organization_id', orgId)
                .order('full_name')
                .limit(5000);

            if (managersData) {
                setManagers(managersData as any);
            }

            // Fetch Departments
            const { data: deptsData } = await supabase
                .from('departments')
                .select('id, name')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('name');

            if (deptsData) {
                setAvailableDepartments(deptsData);
            }

            // Fetch Job Titles
            const { data: jobsData, error: jobsError } = await supabase
                .from('job_titles')
                .select('id, title, sector_id, department_id')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('title');

            if (jobsError) console.error('Error fetching jobs:', jobsError);

            if (jobsData) {
                setAvailableJobTitles(jobsData);
            }

            // Fetch Sectors
            const { data: sectorsData } = await supabase
                .from('sectors')
                .select('id, name, department_id')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('name');

            if (sectorsData) {
                setAvailableSectors(sectorsData);
            }

            // Fetch Organization Roles
            const { data: rolesData } = await supabase
                .from('organization_roles')
                .select('id, name')
                .eq('organization_id', orgId)
                .order('name');

            if (rolesData) {
                setAvailableRoles(rolesData);
            }

            // Fetch CRM Stores for Operação/Loja field
            const { data: storesData } = await supabase
                .from('crm_stores')
                .select('id, name')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('name');

            if (storesData) {
                setAvailableStores(storesData);
            }
        };

        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            if (userToEdit) {
                setFullName(userToEdit.full_name || '');
                setRole(userToEdit.role || 'user');
                setEmail(userToEdit.email || '');

                let loadedCpf = userToEdit.cpf || '';
                if (loadedCpf.length === 11) {
                    loadedCpf = loadedCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                }
                setCpf(loadedCpf);
                setBirthDate(userToEdit.birth_date || '');

                setJobTitleId(userToEdit.job_title_id || '');
                setDepartmentId(userToEdit.department_id || '');
                setSectorId(userToEdit.sector_id || '');
                setManagerId(userToEdit.manager_id || '');
                setManagerName((userToEdit as any).manager_name || '');
                setGender(userToEdit.gender || '');
                setOrganizationRoleId(userToEdit.organization_role_id || '');
                setAdmissionDate((userToEdit as any).admission_date || '');
                setInactivationDate((userToEdit as any).inactivation_date || '');
                setCrmStoreId((userToEdit as any).crm_store_id || '');

                setPassword('');
                setConfirmPassword('');
                setShowPassword(false);
            } else {
                // Reset form for new user
                setFullName('');
                setEmail('');
                setRole('user');
                setCpf('');
                setBirthDate('');

                setJobTitleId('');
                setDepartmentId('');
                setSectorId('');
                setManagerId('');
                setManagerName('');
                setGender('');
                setOrganizationRoleId('');
                setAdmissionDate('');
                setInactivationDate('');
                setCrmStoreId('');
                setPassword('');
                setConfirmPassword('');
                setShowPassword(false);
                setSendWelcome(true);
            }
            // Reset state on open
            setStep(1);
            setError(null);
            setCpfError('');
            setEmailError('');
        }
    }, [isOpen, userToEdit]);

    if (!isOpen) return null;

    const checkDuplicates = async () => {
        let hasError = false;
        setCpfError('');
        setEmailError('');

        // Validate CPF
        if (cpf) {
            // Optimization: If editing and CPF hasn't changed, skip unique check
            if (userToEdit && userToEdit.cpf === cpf) {
                return true;
            }

            let query = supabase
                .from('profiles')
                .select('id')
                .eq('cpf', cpf.replace(/\D/g, ''));

            if (userToEdit) {
                query = query.neq('id', userToEdit.id);
            }

            const { data: cpfData } = await query;
            if (cpfData && cpfData.length > 0) {
                setCpfError('CPF já cadastrado no sistema.');
                hasError = true;
            }
        }

        // Validate Email (via API check or assume handled by submit, but user requested explicit validation)
        // Since we don't have direct access to auth.users, we might not be able to fully validate unique email 
        // without an admin API call or submit.
        // However, for UX, we can check if any profile has this email if we synced it, but we haven't.
        // We will rely on submit error for Email, but checking CPF client-side is possible.
        // If the user REALLY wants email validation before submit, we'd need a backend endpoint `check-email`.

        // For now, let's proceed with CPF check.
        return !hasError;
    };

    const handleNextStep = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
        }

        // Validate Step 1
        if (!fullName || !email) {
            setError('Por favor, preencha os campos obrigatórios (Nome, Email).');
            return;
        }

        if (password && password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            const isValid = await checkDuplicates();
            if (isValid) {
                setError(null);
                setStep(2);
            }
        } catch (error) {
            console.error("Error checking duplicates:", error);
            setError("Erro ao validar dados. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (userToEdit) {
                // Check if email changed
                if (email !== userToEdit.email) {
                    const response = await fetch('/api/users/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                        },
                        body: JSON.stringify({
                            id: userToEdit.id,
                            email,
                            password: password || undefined // Send password only if provided
                        })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || 'Erro ao atualizar email (possível duplicidade).');
                    }
                }

                // Update profile data via direct DB call (faster/simpler than API if only profile changed)
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        role: role,
                        cpf: cpf.replace(/\D/g, ''),
                        birth_date: birthDate || null,
                        job_title_id: jobTitleId || null,
                        department_id: departmentId || null,
                        sector_id: sectorId || null,
                        manager_id: managerId || null,
                        gender,
                        organization_role_id: organizationRoleId || null,
                        admission_date: admissionDate || null,
                        inactivation_date: inactivationDate || null,
                        crm_store_id: crmStoreId || null,
                    })
                    .eq('id', userToEdit.id);

                if (updateError) {
                    if (updateError.code === '23505') { // Unique violation
                        throw new Error('CPF já cadastrado.');
                    }
                    console.error('Update profile error:', updateError);
                    throw updateError;
                }

            } else {
                // Create Mode - Invite API
                // Get session for token
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    throw new Error("Sessão expirada. Faça login novamente.");
                }

                const response = await fetch('/api/users/invite', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        fullName,
                        email,
                        role,
                        organization_id: session.user.user_metadata.organization_id,
                        cpf: cpf.replace(/\D/g, ''),
                        birthDate,

                        jobTitleId,
                        departmentId,
                        sectorId,
                        managerId: managerId || null,
                        gender,
                        organizationRoleId: organizationRoleId || null,
                        admissionDate: admissionDate || null,
                        inactivationDate: inactivationDate || null,
                        sendWelcome
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao convidar usuário');
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error saving user:", err);
            // Translate common auth errors if possible
            if (err.message?.includes('already registered') || err.message?.includes('violates unique constraint')) {
                setError('Email ou CPF já cadastrado.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }

        setCpf(value);
    };

    return createPortal(
        <div className="relative z-9999" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose}></div>

            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start flex-col">
                                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        {userToEdit ? 'Editar Usuário' : 'Adicionar Usuário'}
                                    </h3>

                                    {/* Stepper */}
                                    <div className="mt-4 mb-6">
                                        <div className="flex items-center justify-between relative">
                                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
                                            <div className={`flex flex-col items-center bg-white px-2 ${step >= 1 ? 'text-brand' : 'text-gray-400'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 ${step >= 1 ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white'}`}>
                                                    1
                                                </div>
                                                <span className="text-xs font-medium">Dados Pessoais</span>
                                            </div>
                                            <div className={`flex flex-col items-center bg-white px-2 ${step >= 2 ? 'text-brand' : 'text-gray-400'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 ${step >= 2 ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white'}`}>
                                                    2
                                                </div>
                                                <span className="text-xs font-medium">Dados Profissionais</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <form id="user-form" onSubmit={handleSubmit} className="space-y-6">

                                            {/* Step 1: Dados Pessoais */}
                                            {step === 1 && (
                                                <div className="space-y-4 animate-fadeIn">
                                                    <h4 className="text-sm font-medium text-gray-900 border-b pb-1">Dados Pessoais</h4>

                                                    <div>
                                                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Nome Completo <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            id="fullName"
                                                            required
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                            value={fullName}
                                                            onChange={e => setFullName(e.target.value)}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="email"
                                                            id="email"
                                                            required
                                                            className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                                                            value={email}
                                                            onChange={e => {
                                                                setEmail(e.target.value);
                                                                setEmailError('');
                                                            }}
                                                        />
                                                        {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                                        <div>
                                                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                                                {userToEdit ? 'Nova Senha (Opcional)' : 'Senha (Opcional)'}
                                                            </label>
                                                            <div className="relative">
                                                                <input
                                                                    type={showPassword ? "text" : "password"}
                                                                    id="password"
                                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm pr-10"
                                                                    value={password}
                                                                    onChange={e => setPassword(e.target.value)}
                                                                    placeholder={userToEdit ? "Mantenha em branco para não alterar" : "Deixe em branco para enviar convite"}
                                                                    minLength={6}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                                    onClick={() => setShowPassword(!showPassword)}
                                                                >
                                                                    {showPassword ? (
                                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar Senha</label>
                                                            <div className="relative">
                                                                <input
                                                                    type={showPassword ? "text" : "password"}
                                                                    id="confirmPassword"
                                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm pr-10"
                                                                    value={confirmPassword}
                                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                                    placeholder="Confirme a senha"
                                                                    minLength={6}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
                                                                    onClick={() => setShowPassword(!showPassword)}
                                                                >
                                                                    {showPassword ? (
                                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {password !== confirmPassword && confirmPassword.length > 0 && (
                                                        <p className="text-red-500 text-xs">As senhas não coincidem.</p>
                                                    )}

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label>
                                                            <input
                                                                type="text"
                                                                id="cpf"
                                                                className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm ${cpfError ? 'border-red-500' : 'border-gray-300'}`}
                                                                value={cpf}
                                                                onChange={(e) => {
                                                                    handleCpfChange(e);
                                                                    setCpfError('');
                                                                }}
                                                                placeholder="000.000.000-00"
                                                                maxLength={14}
                                                            />
                                                            {cpfError && <p className="text-red-500 text-xs mt-1">{cpfError}</p>}
                                                        </div>
                                                        <div>
                                                            <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                                                            <input
                                                                type="date"
                                                                id="birthDate"
                                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                                value={birthDate}
                                                                onChange={e => setBirthDate(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label htmlFor="admissionDate" className="block text-sm font-medium text-gray-700">Data de Admissão</label>
                                                            <input
                                                                type="date"
                                                                id="admissionDate"
                                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                                value={admissionDate}
                                                                onChange={e => setAdmissionDate(e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="inactivationDate" className="block text-sm font-medium text-gray-700">Data de Inativação</label>
                                                            <input
                                                                type="date"
                                                                id="inactivationDate"
                                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                                                                value={inactivationDate}
                                                                onChange={e => setInactivationDate(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gênero</label>
                                                        <select
                                                            id="gender"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={gender}
                                                            onChange={e => setGender(e.target.value)}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            <option value="Masculino">Masculino</option>
                                                            <option value="Feminino">Feminino</option>
                                                            <option value="Outro">Outro</option>
                                                            <option value="Prefiro não dizer">Prefiro não dizer</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Step 2: Dados Profissionais */}
                                            {step === 2 && (
                                                <div className="space-y-4 animate-fadeIn">
                                                    <h4 className="text-sm font-medium text-gray-900 border-b pb-1">Dados Profissionais</h4>

                                                    {userToEdit && userToEdit.employee_id && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                                                            <div className="mt-1 py-2 px-3 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-500">
                                                                {userToEdit.employee_id}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label htmlFor="department" className="block text-sm font-medium text-gray-700">Departamento</label>
                                                        <select
                                                            id="department"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={departmentId}
                                                            onChange={e => {
                                                                setDepartmentId(e.target.value);
                                                                setSectorId(''); // Reset sector
                                                                setJobTitleId(''); // Reset job title
                                                            }}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {availableDepartments.map(dept => (
                                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="sector" className="block text-sm font-medium text-gray-700">Setor</label>
                                                        <select
                                                            id="sector"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={sectorId}
                                                            onChange={e => {
                                                                setSectorId(e.target.value);
                                                                setJobTitleId(''); // Reset job title when sector changes
                                                            }}
                                                            disabled={!departmentId}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {availableSectors && availableSectors
                                                                .filter(sector => !departmentId || sector.department_id === departmentId)
                                                                .map(sector => (
                                                                    <option key={sector.id} value={sector.id}>{sector.name}</option>
                                                                ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700">Cargo</label>
                                                        <select
                                                            id="jobTitle"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={jobTitleId}
                                                            onChange={e => setJobTitleId(e.target.value)}
                                                            disabled={!departmentId}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {availableJobTitles && availableJobTitles
                                                                .filter(job => {
                                                                    // If sector is selected, show jobs for that sector
                                                                    if (sectorId) {
                                                                        return job.sector_id === sectorId;
                                                                    }
                                                                    // If no sector selected but department is, show jobs for that department (without specific sector)
                                                                    // OR jobs that belong to that department (if your business logic allows selecting any job in dept)
                                                                    // Based on user request "cargo que não tenha setor associado mas seja do departamento selecionado"
                                                                    // We ALSO need to allow jobs that have NO department_id (created globally by integrations)
                                                                    if (departmentId) {
                                                                        return (job.department_id === departmentId || !job.department_id) && (!job.sector_id);
                                                                    }
                                                                    return false;
                                                                })
                                                                .map(job => (
                                                                    <option key={job.id} value={job.id}>{job.title}</option>
                                                                ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="manager" className="block text-sm font-medium text-gray-700">Líder (Gestor)</label>
                                                        <select
                                                            id="manager"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={managerId}
                                                            onChange={e => setManagerId(e.target.value)}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {managers && managers.map(manager => (
                                                                <option key={manager.id} value={manager.id}>
                                                                    {manager.full_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="role" className="block text-sm font-medium text-gray-700">Perfil</label>
                                                        <select
                                                            id="role"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={organizationRoleId}
                                                            onChange={e => setOrganizationRoleId(e.target.value)}
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {availableRoles && availableRoles.map(r => (
                                                                <option key={r.id} value={r.id}>{r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label htmlFor="crmStore" className="block text-sm font-medium text-gray-700">
                                                            Operação / Loja
                                                            <span className="ml-1 text-xs text-gray-400 font-normal">(BKO — acesso no CRM)</span>
                                                        </label>
                                                        <select
                                                            id="crmStore"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm bg-white"
                                                            value={crmStoreId}
                                                            onChange={e => setCrmStoreId(e.target.value)}
                                                        >
                                                            <option value="">Nenhuma (acesso global)</option>
                                                            {availableStores.map(store => (
                                                                <option key={store.id} value={store.id}>{store.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="mt-1 text-xs text-gray-400">Se definido, o usuário verá apenas as vendas desta operação no Acompanhamento do CRM.</p>
                                                    </div>

                                                    {!userToEdit && (
                                                        <div className="pt-2">
                                                            <div className="flex items-center">
                                                                <input
                                                                    id="sendWelcome"
                                                                    type="checkbox"
                                                                    checked={sendWelcome}
                                                                    onChange={(e) => setSendWelcome(e.target.checked)}
                                                                    className="h-4 w-4 text-brand focus:ring-brand border-gray-300 rounded"
                                                                />
                                                                <label htmlFor="sendWelcome" className="ml-2 block text-sm text-gray-900">
                                                                    Enviar email de boas-vindas ao criar usuário
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {error && (
                                                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
                                            )}
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            {step === 2 ? (
                                <>
                                    <button
                                        type="submit"
                                        form="user-form"
                                        disabled={loading}
                                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand text-base font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand sm:ml-3 sm:w-auto sm:text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {loading ? 'Salvando...' : (userToEdit ? 'Salvar Alterações' : 'Adicionar')}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        onClick={() => setStep(1)}
                                    >
                                        Voltar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand text-base font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {loading ? 'Verificando...' : 'Próximo'}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        onClick={onClose}
                                    >
                                        Cancelar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div >
        </div >,
        document.body
    );
}
