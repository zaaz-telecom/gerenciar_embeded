import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper to clean CPF
const cleanCpf = (cpf: string) => cpf?.replace(/\D/g, '');

// Fetch CRON_SECRET from the database (app_secrets table)
async function getCronSecret(): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('app_secrets')
        .select('value')
        .eq('key', 'CRON_SECRET')
        .single();
    return data?.value || null;
}

export const POST: APIRoute = async ({ request }) => {
    return handleSync(request);
};

export const GET: APIRoute = async ({ request }) => {
    return handleSync(request);
};

async function handleSync(request: Request) {
    const syncStartTime = Date.now();
    console.log(`[Voors Sync] Started at ${new Date().toISOString()}`);

    try {
        let organizationIdsToSync: string[] = [];
        let triggerType: 'manual' | 'cron' = 'manual';

        // 1. Authenticate Request
        const authHeader = request.headers.get('Authorization');
        const internalCronHeader = request.headers.get('x-cron-secret');
        const url = new URL(request.url);
        const queryCronSecret = url.searchParams.get('cron_secret');

        // Check cron authentication (secret stored in DB, not env)
        const cronSecret = await getCronSecret();
        const isCronTrigger = cronSecret && (internalCronHeader === cronSecret || queryCronSecret === cronSecret);

        if (isCronTrigger) {
            triggerType = 'cron';
            console.log('[Voors Sync] Authenticated via cron secret');

            // Cron Job Trigger: Sync all organizations that have auto_sync enabled
            const { data: orgs, error } = await supabaseAdmin
                .from('voors_settings')
                .select('organization_id')
                .eq('auto_sync_enabled', true);

            if (error) throw error;
            organizationIdsToSync = orgs.map(o => o.organization_id);

            if (organizationIdsToSync.length === 0) {
                console.log('[Voors Sync] No organizations configured for auto-sync.');
                return new Response(JSON.stringify({ message: 'No organizations configured for auto-sync.' }), { status: 200 });
            }

            console.log(`[Voors Sync] Cron trigger: ${organizationIdsToSync.length} org(s) to sync`);
        } else if (authHeader) {
            // Manual Trigger from UI
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401 });

            // Ensure user is admin of their org
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('organization_id, role')
                .eq('id', user.id)
                .single();

            if (!profile || profile.role !== 'admin') {
                return new Response(JSON.stringify({ error: 'Unauthorized: Admins only' }), { status: 403 });
            }
            organizationIdsToSync = [profile.organization_id];
        } else {
            return new Response(JSON.stringify({ error: 'Missing Authentication' }), { status: 401 });
        }

        const results = [];

        // 2. Process each organization
        for (const orgId of organizationIdsToSync) {
            try {
                // Get Voors Settings
                const { data: settings } = await supabaseAdmin
                    .from('voors_settings')
                    .select('token')
                    .eq('organization_id', orgId)
                    .single();

                if (!settings?.token) {
                    results.push({ orgId, status: 'skipped', reason: 'No token configured' });
                    continue;
                }

                // Fetch from Voors
                const voorsApiUrl = 'http://social.nela.com.br:1344/goals?startDate=2022-07-01&endDate=2050-12-31';
                console.log(`[Voors Sync] Fetching users from Voors API for org ${orgId}...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

                let voorsResponse: Response;
                try {
                    voorsResponse = await fetch(voorsApiUrl, {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Authorization': settings.token,
                            'Accept': '*/*'
                        },
                        signal: controller.signal
                    });
                } catch (fetchErr: any) {
                    clearTimeout(timeoutId);
                    throw new Error(`Voors API unreachable: ${fetchErr.message}`);
                }
                clearTimeout(timeoutId);

                if (!voorsResponse.ok) {
                    throw new Error(`Voors API returned ${voorsResponse.status}`);
                }

                const payload = await voorsResponse.json();

                // Clear Staging for this org
                await supabaseAdmin
                    .from('voors_users_staging')
                    .delete()
                    .eq('organization_id', orgId);

                // Insert into Staging
                await supabaseAdmin
                    .from('voors_users_staging')
                    .insert({
                        organization_id: orgId,
                        payload: payload,
                        status: 'success'
                    });

                // Upsert to Profiles logic
                const { data: mappings } = await supabaseAdmin
                    .from('voors_field_mapping')
                    .select('*');

                const mappingDict = mappings?.reduce((acc: any, curr: any) => {
                    acc[curr.voors_key] = curr.system_column;
                    return acc;
                }, {}) || {};

                // Find or Create Departments dynamically
                const departmentsInPayload = [...new Set(payload.map((u: any) => u.departmentName).filter(Boolean))];
                const { data: existingDepts } = await supabaseAdmin.from('departments').select('id, name').eq('organization_id', orgId);
                const deptMap: Record<string, string> = {};
                for (const d of existingDepts || []) deptMap[d.name.toLowerCase()] = d.id;

                for (const dName of departmentsInPayload) {
                    const cleanName = String(dName).trim();
                    if (!deptMap[cleanName.toLowerCase()]) {
                        const { data: newDept } = await supabaseAdmin.from('departments').insert({ organization_id: orgId, name: cleanName, is_active: true }).select('id').single();
                        if (newDept) deptMap[cleanName.toLowerCase()] = newDept.id;
                    }
                }

                // Find or Create Job Titles dynamically
                const jobsInPayload = [...new Set(payload.map((u: any) => u.jobRoleTitle).filter(Boolean))];
                const { data: existingJobs } = await supabaseAdmin.from('job_titles').select('id, title').eq('organization_id', orgId);
                const jobMap: Record<string, string> = {};
                for (const j of existingJobs || []) jobMap[j.title.toLowerCase()] = j.id;

                for (const jTitle of jobsInPayload) {
                    const cleanTitle = String(jTitle).trim();
                    if (!jobMap[cleanTitle.toLowerCase()]) {
                        const { data: newJob } = await supabaseAdmin.from('job_titles').insert({ organization_id: orgId, title: cleanTitle, is_active: true }).select('id').single();
                        if (newJob) jobMap[cleanTitle.toLowerCase()] = newJob.id;
                    }
                }

                // Build lookup maps based on ALL current profiles for this org
                // Fetching columns we need to compare
                const allProfiles: any[] = [];
                let hasMoreProfiles = true;
                let offset = 0;
                const batchSize = 1000;

                while (hasMoreProfiles) {
                    const { data: batch, error: batchErr } = await supabaseAdmin.from('profiles')
                        .select('id, full_name, role, status, cpf, birth_date, can_export_data, manager_id, manager_name, gender, admission_date, inactivation_date, job_title_id, department_id, sector_id, organization_role_id, email')
                        .eq('organization_id', orgId)
                        .range(offset, offset + batchSize - 1);

                    if (batchErr) {
                        console.error("[Voors Sync] Error fetching profiles batch:", batchErr);
                        break;
                    }

                    if (batch && batch.length > 0) {
                        allProfiles.push(...batch);
                        offset += batchSize;
                        if (batch.length < batchSize) hasMoreProfiles = false;
                    } else {
                        hasMoreProfiles = false;
                    }
                }
                console.log(`[Voors Sync] Total profiles loaded: ${allProfiles.length}`);

                const nameToProfileIdMap: Record<string, string> = {};
                const cpfToProfileMap: Record<string, any> = {};
                const idToProfileMap: Record<string, any> = {};

                if (allProfiles) {
                    allProfiles.forEach(p => {
                        if (p.full_name) {
                            nameToProfileIdMap[p.full_name.trim().toLowerCase()] = p.id;
                        }
                        if (p.cpf) {
                            const cleanedCpfInDb = p.cpf.replace(/\D/g, '');
                            cpfToProfileMap[cleanedCpfInDb] = p;
                        }
                        idToProfileMap[p.id] = p;
                    });
                }

                // Helper to check if data is actually different
                const isDifferent = (newData: any, oldData: any, debug = false) => {
                    for (const key of Object.keys(newData)) {
                        let newValue = newData[key];
                        let oldValue = oldData[key];

                        // Normalize dates for comparison
                        if (key.includes('date') || key.includes('_at')) {
                            const dNew = newValue ? new Date(newValue).getTime() : 0;
                            const dOld = oldValue ? new Date(oldValue).getTime() : 0;
                            if (dNew !== dOld) {
                                if (debug) console.log(`[Voors Sync] Diff in ${key}: ${dNew} !== ${dOld}`);
                                return true;
                            }
                            continue;
                        }

                        // Treat null/undefined/empty string as equivalent for most fields
                        const normalizedNew = (newValue === null || newValue === undefined || newValue === '') ? null : String(newValue).trim();
                        const normalizedOld = (oldValue === null || oldValue === undefined || oldValue === '') ? null : String(oldValue).trim();
                        
                        if (normalizedNew !== normalizedOld) {
                            if (debug) console.log(`[Voors Sync] Diff in ${key}: "${normalizedNew}" !== "${normalizedOld}"`);
                            return true;
                        }
                    }
                    return false;
                };

                let createdCount = 0;
                let updatedCount = 0;
                let activeCount = 0;
                let inactiveCount = 0;

                // Ordenar o array por "data de admissao" ASC antes de inserir, para que a SEQUENCE da matrícula 
                // do banco (employee_id BIGINT GENERATED BY DEFAULT AS IDENTITY) fique em ordem cronológica de contratação.
                payload.sort((a: any, b: any) => {
                    const dateA = a['data de admissao'] ? new Date(a['data de admissao']).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b['data de admissao'] ? new Date(b['data de admissao']).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB;
                });

                // Fetch all auth.users for this org to match by email (using RPC or just matching profiles since we might not have email in profiles)
                // Wait, we DO NOT have email in profiles easily accessible without admin join, 
                // but we CAN fetch all auth users from supabaseAdmin to build an email lookup!
                const emailToAuthId: Record<string, string> = {};
                const idToEmail: Record<string, string> = {};

                let hasMoreUsers = true;
                let page = 1;
                let loadedUsersCount = 0;
                while (hasMoreUsers) {
                    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
                        page: page,
                        perPage: 1000
                    });

                    if (usersErr || !usersData?.users || usersData.users.length === 0) {
                        hasMoreUsers = false;
                        if (usersErr) console.error("[Voors Sync] Error fetching admin users:", usersErr);
                        break;
                    }

                    usersData.users.forEach(u => {
                        if (u.email) {
                            const lowerEmail = u.email.toLowerCase().trim();
                            emailToAuthId[lowerEmail] = u.id;
                            idToEmail[u.id] = lowerEmail;
                        }
                    });

                    loadedUsersCount += usersData.users.length;
                    if (usersData.users.length < 1000) {
                        hasMoreUsers = false;
                    } else {
                        page++;
                    }
                }
                console.log(`[Voors Sync] Loaded ${loadedUsersCount} auth users for mapping.`);

                for (const voorsUser of payload) {
                    const rawCpf = voorsUser.CPF;
                    if (!rawCpf) continue;

                    const userCpfRaw = cleanCpf(rawCpf);
                    if (!userCpfRaw || userCpfRaw.length !== 11) continue;
                    
                    const userFullName = voorsUser.userFullName || voorsUser.Name || voorsUser.full_name || 'Usuário Sem Nome';

                    // Specific user for deep logging (Ana Luiza, Leidiane)
                    const isUserDebug = ['06332593300', '02391262388'].includes(userCpfRaw);

                    // Build profile data based on mappings
                    const profileData: any = {};
                    for (const [vKey, val] of Object.entries(voorsUser)) {
                        const sysCol = mappingDict[vKey];
                            if (isUserDebug) {
                                console.log(`[Voors Sync] DEBUG Mapping for ${userFullName}: Key "${vKey}", Value "${val}", SystemCol "${sysCol}"`);
                            }

                            if (sysCol && val !== undefined) {
                            if (val === null || String(val).trim() === "") {
                                // Se os dados vierem em branco (nulo ou vazio) do Voors, 
                                // vamos limpar no banco também para refletir a exclusão (ex: sem cargo, sem departamento)
                                // CPF e status normalmente não devem ser anulados.
                                if (sysCol !== 'cpf' && sysCol !== 'status') {
                                    if (sysCol === 'department' || sysCol === 'department_id') profileData['department_id'] = null;
                                    else if (sysCol === 'job_title' || sysCol === 'job_title_id') profileData['job_title_id'] = null;
                                    else profileData[sysCol] = null;
                                }
                                continue;
                            }

                            // Translate some generic fields to our system enum if needed
                            if (sysCol === 'status') {
                                profileData[sysCol] = (val === 'active' || String(val).toLowerCase() === 'ativo') ? 'active' : 'inactive';
                            } else if (sysCol === 'department' || sysCol === 'department_id') {
                                // Map by Name to Foreign Key UUID
                                profileData['department_id'] = deptMap[String(val).trim().toLowerCase()] || null;
                            } else if (sysCol === 'job_title' || sysCol === 'job_title_id') {
                                // Map by Title to Foreign Key UUID
                                profileData['job_title_id'] = jobMap[String(val).trim().toLowerCase()] || null;
                            } else if (sysCol === 'manager_name' || sysCol === 'manager_id') {
                                profileData['manager_name'] = val;
                                profileData['manager_id'] = nameToProfileIdMap[String(val).trim().toLowerCase()] || null;
                            } else if (sysCol === 'cpf') {
                                profileData['cpf'] = userCpfRaw; // APENAS NÚMEROS AQUI
                            } else {
                                profileData[sysCol] = val;
                            }
                        }
                    }

                    // Count statuses
                    if (profileData.status === 'active') activeCount++;
                    else if (profileData.status === 'inactive') inactiveCount++;

                    // Alias map handling
                    if (profileData['name']) {
                        if (!profileData['full_name']) profileData['full_name'] = profileData['name'];
                    }

                    // Remove invalid columns mapped by mistake so supabase doesn't reject the query
                    const allowedColumns = [
                        'full_name', 'role', 'status', 'cpf', 'birth_date', 'can_export_data',
                        'manager_id', 'manager_name', 'gender', 'admission_date', 'inactivation_date',
                        'job_title_id', 'department_id', 'sector_id', 'organization_role_id',
                        'email'
                    ];
                    for (const k of Object.keys(profileData)) {
                        if (!allowedColumns.includes(k)) {
                            delete profileData[k];
                        }
                    }

                    // For email fallback if not mapped or empty
                    const voorsEmail = (voorsUser.email?.trim() || `voors_${userCpfRaw}@org${orgId}.com`).toLowerCase();

                    // 1. Try to find by CPF in our local map
                    let matchedProfile = cpfToProfileMap[userCpfRaw];
                    
                    // 2. Try to find by Email in Auth mapped to Profile ID in our local map
                    if (!matchedProfile && emailToAuthId[voorsEmail]) {
                        matchedProfile = idToProfileMap[emailToAuthId[voorsEmail]];
                    }

                    if (isUserDebug) {
                        console.log(`[Voors Sync] DEBUG Final profileData for ${userFullName}:`, JSON.stringify(profileData));
                    }

                    if (matchedProfile) {
                        const matchedProfileId = matchedProfile.id;
                        // Update existing profile!
                        if (!profileData.cpf) profileData.cpf = userCpfRaw; // Ensure numeric CPF is saved
                        
                        // Force email into profileData if it was found in voorsUser but maybe missed by mapping
                        if (!profileData.email && (voorsUser.email || voorsUser.Email)) {
                            profileData.email = (voorsUser.email || voorsUser.Email).toLowerCase().trim();
                            if (isUserDebug) console.log(`[Voors Sync] DEBUG Forced email into profileData: ${profileData.email}`);
                        }

                        // We keep the email in profileData so it syncs to the profiles table

                        if (Object.keys(profileData).length > 0) {
                            // 1. Sync Email if changed in Voors (Update Auth User)
                            // Get current email from Auth mapping, fallback to profile email if mapping missed it
                            let currentEmail = idToEmail[matchedProfileId] || matchedProfile.email;
                            
                            // Prioritize the email from mapping, fallback to voorsUser.email
                            const newVoorsEmail = (profileData.email || voorsUser.email || voorsUser.Email)?.toLowerCase().trim();
                            
                            if (isUserDebug) {
                                console.log(`[Voors Sync] ${userFullName} Check: AuthMap=${idToEmail[matchedProfileId]}, Profile=${matchedProfile.email}, New=${newVoorsEmail}`);
                            }

                            // Only update if Voors provided an explicit email and it's different from current
                            if (newVoorsEmail && newVoorsEmail !== currentEmail?.toLowerCase().trim()) {
                                console.log(`[Voors Sync] ${userFullName}: Email change detected! "${currentEmail}" -> "${newVoorsEmail}"`);
                                const { error: emailUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(matchedProfileId, {
                                    email: newVoorsEmail,
                                    email_confirm: true,
                                    user_metadata: { 
                                        organization_id: orgId,
                                        sync_source: 'voors',
                                        last_email_sync: new Date().toISOString()
                                    }
                                });
                                
                                if (emailUpdateErr) {
                                    console.error(`[Voors Sync] EXCEPTION: Auth email update failed for ${userFullName} (${matchedProfileId}):`, emailUpdateErr.message);
                                    // We still keep profileData.email to attempt profile update if it was mapped, 
                                    // but usually we want them in sync. 
                                    // If it's a "duplicate email" error, it will fail here.
                                } else {
                                    console.log(`[Voors Sync] SUCCESS: Auth email updated for ${userFullName}`);
                                    idToEmail[matchedProfileId] = newVoorsEmail;
                                    emailToAuthId[newVoorsEmail] = matchedProfileId; 
                                }
                            }

                            // 2. Sync Profile data ONLY IF DIFFERENT
                            if (isUserDebug) {
                                console.log(`[Voors Sync] Debugging user ${userFullName}:`, {
                                    currentEmail,
                                    newVoorsEmail,
                                    profileDataKeys: Object.keys(profileData),
                                    profileData,
                                    matchedProfileKeys: Object.keys(matchedProfile)
                                });
                            }

                            if (isDifferent(profileData, matchedProfile, isUserDebug)) {
                                if (isUserDebug) console.log(`[Voors Sync] User ${userFullName} marked as DIFFERENT, updating...`);
                                const { error: upErr } = await supabaseAdmin
                                    .from('profiles')
                                    .update(profileData)
                                    .eq('id', matchedProfileId);

                                if (upErr) {
                                    console.error('Erro ao atualizar', userFullName, upErr);
                                } else {
                                    updatedCount++;
                                }
                            }
                        }
                    } else {
                        // Create Auth User
                        const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
                            email: voorsEmail,
                            email_confirm: true,
                            password: Math.random().toString(36).slice(-10) + 'A1!',
                            user_metadata: {
                                full_name: userFullName,
                                organization_id: orgId,
                                cpf: userCpfRaw,
                                role: profileData.role || 'user'
                            }
                        });

                        if (!createUserError && authUser?.user) {
                            profileData.cpf = userCpfRaw;

                            // The handle_new_user trigger creates the basic profile.
                            // We update the newly created profile with additional mapped fields
                            await supabaseAdmin
                                .from('profiles')
                                .update(profileData)
                                .eq('id', authUser.user.id);
                            createdCount++;

                            // Add to fast email lookup
                            emailToAuthId[voorsEmail] = authUser.user.id;
                        } else {
                            console.error('Error creating user inside Voors sync:', createUserError);
                        }
                    }
                }

                // Update settings last_sync_at
                await supabaseAdmin
                    .from('voors_settings')
                    .update({ last_sync_at: new Date().toISOString() })
                    .eq('organization_id', orgId);

                // Insert into voors_sync_history
                await supabaseAdmin
                    .from('voors_sync_history')
                    .insert({
                        organization_id: orgId,
                        trigger_type: triggerType,
                        status: 'success',
                        total_users_fetched: payload.length,
                        total_users_created: createdCount,
                        total_users_updated: updatedCount,
                        active_users_count: activeCount,
                        inactive_users_count: inactiveCount
                    });

                console.log(`[Voors Sync] Org ${orgId}: ${createdCount} created, ${updatedCount} updated, ${activeCount} active, ${inactiveCount} inactive`);
                results.push({ orgId, status: 'success', created: createdCount, updated: updatedCount, active: activeCount, inactive: inactiveCount });

            } catch (err: any) {
                console.error(`Sync error for org ${orgId}:`, err);

                // Insert into voors_sync_history as error
                await supabaseAdmin
                    .from('voors_sync_history')
                    .insert({
                        organization_id: orgId,
                        trigger_type: triggerType,
                        status: 'error',
                        error_message: err.message
                    });

                results.push({ orgId, status: 'error', message: err.message });
            }
        }

        const elapsed = ((Date.now() - syncStartTime) / 1000).toFixed(1);
        console.log(`[Voors Sync] Completed in ${elapsed}s. Results: ${JSON.stringify(results)}`);
        return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        const elapsed = ((Date.now() - syncStartTime) / 1000).toFixed(1);
        console.error(`[Voors Sync] Fatal error after ${elapsed}s:`, error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
}
