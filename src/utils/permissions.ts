import { supabase } from '../lib/supabase';
import type { AppPermissions, PermissionRules } from '../types/dashboard';

export const DEFAULT_PERMISSIONS: AppPermissions = {
    users: { view: false, create: false, edit: false, delete: false },
    processes: { view: false, create: false, edit: false, delete: false },
    indicators: { view: false, create: false, edit: false, delete: false },
    profiles: { view: false, create: false, edit: false, delete: false },
    contracts: { view: false, create: false, edit: false, delete: false },
    crm: { view: false, create: false, edit: false, delete: false },
    crm_admin: { view_all: false, manage: false, configure: false },
    organization: { manage_settings: false },
};

export function hasPermission(
    permissions: AppPermissions | undefined | null,
    resource: keyof AppPermissions,
    action: string,
    isOrgAdmin: boolean = false
): boolean {
    if (isOrgAdmin) return true;
    if (!permissions) return false;

    const resourcePermissions = permissions[resource];

    if (!resourcePermissions) return false;

    if (resource === 'organization') {
        return (resourcePermissions as any)[action] === true;
    }

    return (resourcePermissions as PermissionRules)[action as keyof PermissionRules] === true;
}

// Helper to merge stored permissions with default structure to ensure all keys exist
export function mergePermissions(storedPermissions: any): AppPermissions {
    if (!storedPermissions) return DEFAULT_PERMISSIONS;

    return {
        users: { ...DEFAULT_PERMISSIONS.users, ...storedPermissions.users },
        processes: { ...DEFAULT_PERMISSIONS.processes, ...storedPermissions.processes },
        indicators: { ...DEFAULT_PERMISSIONS.indicators, ...storedPermissions.indicators },
        profiles: { ...DEFAULT_PERMISSIONS.profiles, ...storedPermissions.profiles },
        contracts: { ...DEFAULT_PERMISSIONS.contracts, ...storedPermissions.contracts },
        crm: { ...DEFAULT_PERMISSIONS.crm, ...storedPermissions.crm },
        crm_admin: { ...DEFAULT_PERMISSIONS.crm_admin, ...storedPermissions.crm_admin },
        organization: { ...DEFAULT_PERMISSIONS.organization, ...storedPermissions.organization },
    };
}

export async function fetchUserPermissions(userId: string): Promise<{ permissions: AppPermissions, isOrgAdmin: boolean, canExportData: boolean }> {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select(`
                role,
                can_export_data,
                organization_roles (
                    permissions,
                    can_export_data
                )
            `)
            .eq('id', userId)
            .single();

        if (error || !profile) return { permissions: DEFAULT_PERMISSIONS, isOrgAdmin: false, canExportData: false };

        const isOrgAdmin = profile.role === 'admin';

        const roleData = Array.isArray(profile.organization_roles)
            ? profile.organization_roles[0]
            : profile.organization_roles;

        const permissions = roleData?.permissions
            ? mergePermissions(roleData.permissions)
            : DEFAULT_PERMISSIONS;

        const canExportData = isOrgAdmin || profile.can_export_data === true || (roleData as any)?.can_export_data === true;

        return { permissions, isOrgAdmin, canExportData };
    } catch (e) {
        console.error("Error fetching permissions:", e);
        return { permissions: DEFAULT_PERMISSIONS, isOrgAdmin: false, canExportData: false };
    }
}
