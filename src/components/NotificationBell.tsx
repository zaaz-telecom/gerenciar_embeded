import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { SystemMessage } from "../types/system-messages";
import { ProcessService } from "../modules/processes/services";
import { Bell, CheckCircle, Info } from 'lucide-react';

type NotificationItem = {
    id: string;
    type: 'system_message' | 'process_approval' | 'in_app_alert' | 'crm_alert';
    title: string;
    created_at: string;
    read: boolean;
    data: any;
    link?: string;
};

export const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const allNotifications: NotificationItem[] = [];

        // 1. Fetch System Messages
        try {
            const { data: profile } = await supabase
                .from("profiles")
                .select("role, organization_id")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                const now = new Date().toISOString();
                const { data: messages } = await supabase
                    .from("system_messages")
                    .select("*")
                    .eq("status", "active")
                    .eq("organization_id", profile.organization_id)
                    .or(`start_date.is.null,start_date.lte.${now}`)
                    .or(`end_date.is.null,end_date.gte.${now}`)
                    .order('created_at', { ascending: false });

                if (messages) {
                    // Filter
                    const relevant = messages.filter((msg) => {
                        if (msg.target_audience === "all") return true;
                        const targetIds = Array.isArray(msg.target_ids) ? msg.target_ids : [];
                        if (msg.target_audience === "profile") return targetIds.includes(profile.role);
                        if (msg.target_audience === "user") return targetIds.includes(session.user.id);
                        return false;
                    });

                    // Check reads
                    const { data: reads } = await supabase
                        .from("system_message_reads")
                        .select("message_id")
                        .eq("user_id", session.user.id);

                    const readIds = new Set(reads?.map(r => r.message_id));

                    relevant.forEach(msg => {
                        allNotifications.push({
                            id: msg.id,
                            type: 'system_message',
                            title: msg.title,
                            created_at: msg.created_at,
                            read: readIds.has(msg.id),
                            data: msg
                        });
                    });
                }
            }
        } catch (e) {
            console.error("Error fetching messages", e);
        }

        // 2. Fetch Process Approvals
        try {
            const approvals = await ProcessService.getPendingApprovals(session.user.id);
            if (approvals) {
                approvals.forEach((app: any) => {
                    allNotifications.push({
                        id: app.id,
                        type: 'process_approval',
                        title: `Aprovação Pendente: ${app.version.process.title} (v${app.version.version_number})`,
                        created_at: app.created_at,
                        read: false, // Approvals are always "unread" actions until done
                        data: app,
                        link: `/processes/${app.version.process.code || app.version.process.id}` // Link to viewer
                    });
                });
            }
        } catch (e) {
            console.error("Error fetching approvals", e);
        }

        // 3. Fetch In-App Alerts
        try {
            const { data: alerts } = await supabase
                .from('in_app_notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (alerts) {
                alerts.forEach(app => {
                    allNotifications.push({
                        id: app.id,
                        type: 'in_app_alert',
                        title: app.title,
                        created_at: app.created_at,
                        read: app.is_read,
                        data: app,
                        link: app.link
                    });
                });
            }
        } catch (e) {
            console.error("Error fetching alerts", e);
        }

        // Sort by date desc
        allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // 4. Fetch CRM Notifications
        try {
            const { data: crmAlerts } = await supabase
                .from('crm_notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (crmAlerts) {
                crmAlerts.forEach(app => {
                    allNotifications.push({
                        id: app.id,
                        type: 'crm_alert',
                        title: app.title,
                        created_at: app.created_at,
                        read: app.is_read,
                        data: app,
                        link: '/crm'
                    });
                });
            }
        } catch (e) {
            console.error("Error fetching CRM alerts", e);
        }

        // Sort again by date desc to include CRM notifications
        allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setNotifications(allNotifications);
        setUnreadCount(allNotifications.filter(n => !n.read).length);
    };

    useEffect(() => {
        fetchNotifications();

        // Subscriptions
        const channel = supabase
            .channel('public:notifications_bell')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_messages' }, fetchNotifications)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_message_reads' }, fetchNotifications)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'process_version_approvers' }, fetchNotifications)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'in_app_notifications' }, fetchNotifications)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_notifications' }, fetchNotifications)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, []);

    const handleNotificationClick = async (notification: NotificationItem) => {
        setIsOpen(false);

        // Mark in-app-alert as read
        if (notification.type === 'in_app_alert' && !notification.read) {
            await supabase.from('in_app_notifications').update({ is_read: true }).eq('id', notification.id);
            fetchNotifications(); // Optimistic update would be better, but this is safe
        }

        // Mark CRM alert as read
        if (notification.type === 'crm_alert' && !notification.read) {
            await supabase.from('crm_notifications').update({ is_read: true }).eq('id', notification.id);
        }

        if (notification.type === 'process_approval' && notification.link) {
            window.location.href = notification.link;
        } else if ((notification.type === 'in_app_alert' || notification.type === 'crm_alert') && notification.link) {
            window.location.href = notification.link;
        } else if (notification.type === 'system_message') {
            window.dispatchEvent(
                new CustomEvent('open-system-message', {
                    detail: { message: notification.data }
                })
            );
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-gray-500 hover:text-brand hover:bg-gray-50 rounded-full focus:outline-none transition-colors relative"
            >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                        {unreadCount > 0 && <span className="text-xs text-brand font-medium">{unreadCount} novas</span>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <button
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors flex gap-3 ${!notif.read ? 'bg-blue-50/30' : ''}`}
                                >
                                    <div className="mt-1 shrink-0">
                                        {notif.type === 'process_approval' ? (
                                            <CheckCircle className="h-5 w-5 text-amber-500" />
                                        ) : (
                                            <Info className="h-5 w-5 text-brand" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>
                                            {notif.title}
                                        </p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-gray-400">
                                                {new Date(notif.created_at).toLocaleDateString('pt-BR')} {new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            {!notif.read && (
                                                <span className="text-xs text-brand font-medium">
                                                    {notif.type === 'process_approval' ? 'Revisar' : 'Ver'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                Nenhuma notificação
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
