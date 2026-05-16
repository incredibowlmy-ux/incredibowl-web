"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, logout } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import { ArrowLeft, Star, ShoppingBag, Wallet, Calendar, Clock, CheckCircle, ChefHat, Truck, XCircle, Sparkles, Share2, Copy, ChevronLeft, ChevronRight, RefreshCw, LogOut, Settings, Phone, MapPin, Save, X, User as UserIcon, Loader2, AlertCircle, Ticket, Plus } from 'lucide-react';
import {
    tierFromDistance,
    tierFeeHintZh,
    tierLabelZh,
    tierFeeHintEn,
    tierLabelEn,
    FREE_DELIVERY_RADIUS_KM,
    PRICING_V2_CUTOFF_MS,
    type DeliveryZone,
    type DeliveryTier,
} from '@/lib/deliveryUtils';
import { MEMBER_DICT, type Locale } from './dict';
import LanguageSwitcher from '@/components/home/LanguageSwitcher';

// Legacy dish-name → image map. Only used as fallback for orders placed
// BEFORE submit-order started persisting `item.image` on the order doc.
// New dishes don't need to be added here — modern orders carry their own
// image, so this table is only ever read for archive rows from that era.
const LEGACY_DISH_IMAGES: Record<string, string> = {
    '纳豆月见海苔饭': '/natto_bowl.webp',
    '香煎金黄鸡扒饭': '/chicken_chop.webp',
    '山药云耳海陆双鲜': '/yam_surf_turf_egg.webp',
    '山药云耳海陆双鲜炒': '/chinese_yam_black_fungus_v3.webp',
    '招牌原盅当归蒸鸡全腿': '/angelica_chicken.webp',
    '招牌原盅当归清蒸鸡全腿': '/angelica_chicken.webp',
    '马铃薯炖花肉片': '/pork_potato_stew.webp',
    '金黄葱香煎鸡汤': '/scallion_chicken_soup.webp',
};

const resolveDishImage = (item: { name?: string; image?: string } | undefined): string | null => {
    if (!item) return null;
    if (item.image) return item.image;
    if (item.name && LEGACY_DISH_IMAGES[item.name]) return LEGACY_DISH_IMAGES[item.name];
    return null;
};

const ORDERS_PER_PAGE = 5;

export default function MemberView({ locale }: { locale: Locale }) {
    const t = MEMBER_DICT[locale];
    const tierLabel = locale === 'en' ? tierLabelEn : tierLabelZh;
    const tierFeeHint = locale === 'en' ? tierFeeHintEn : tierFeeHintZh;
    const homeHref = locale === 'en' ? '/en' : '/';

    const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
        pending: { label: t.statusPending, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
        confirmed: { label: t.statusConfirmed, color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
        preparing: { label: t.statusPreparing, color: 'bg-purple-100 text-purple-700', icon: ChefHat },
        delivered: { label: t.statusDelivered, color: 'bg-green-100 text-green-700', icon: Truck },
        cancelled: { label: t.statusCancelled, color: 'bg-red-100 text-red-700', icon: XCircle },
    };

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [copied, setCopied] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [redeemedCode, setRedeemedCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [saving, setSaving] = useState(false);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<{ lat: number; lng: number; distanceKm: number; zone: DeliveryZone; formattedAddress: string; partialMatch: boolean } | null>(null);
    const [geocodeError, setGeocodeError] = useState('');
    const [verifiedFor, setVerifiedFor] = useState('');
    const [referralStats, setReferralStats] = useState<{ referredCount: number; confirmedCount: number; pendingCount: number; pointsEarned: number } | null>(null);
    const [myVouchers, setMyVouchers] = useState<{ code: string; discount: number; source: string; expiresAt: string; daysLeft: number }[]>([]);
    const [copiedVoucher, setCopiedVoucher] = useState<string | null>(null);
    const [mealVoucherInfo, setMealVoucherInfo] = useState<{
        availableCount: number;
        soonestDaysLeft: number | null;
        expirySchedule: { date: string; count: number }[];
        recentPurchases: { id: string; bundleId: string; voucherCount: number; amountPaid: number; status: string; createdAtMs: number }[];
    } | null>(null);

    const handleRedeemPoints = async () => {
        if (!currentUser || (profileData?.points || 0) < 100 || redeeming) return;
        setRedeeming(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/redeem-points', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || t.redeemFailed);
                return;
            }
            setProfileData((prev: any) => ({ ...prev, points: data.pointsAfter }));
            setRedeemedCode(data.code);
        } catch (error) {
            console.error("Redeem error:", error);
            alert(t.redeemFailed);
        }
        setRedeeming(false);
    };

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            setAuthChecked(true);
            if (user) {
                loadData(user.uid);
                loadReferralStats(user);
                loadMyVouchers(user);
                loadMealVouchers(user);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadReferralStats = async (user: User) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/referral-stats', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setReferralStats(data);
        } catch (e) {
            console.warn('Failed to load referral stats:', e);
        }
    };

    const loadMyVouchers = async (user: User) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/my-vouchers', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setMyVouchers(data.vouchers || []);
        } catch (e) {
            console.warn('Failed to load vouchers:', e);
        }
    };

    const loadMealVouchers = async (user: User) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/my-meal-vouchers', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setMealVoucherInfo({
                availableCount: data.availableCount || 0,
                soonestDaysLeft: data.soonestDaysLeft ?? null,
                expirySchedule: data.expirySchedule || [],
                recentPurchases: data.recentPurchases || [],
            });
        } catch (e) {
            console.warn('Failed to load meal vouchers:', e);
        }
    };

    const handleCopyVoucher = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedVoucher(code);
        setTimeout(() => setCopiedVoucher(null), 2000);
    };

    const loadData = async (uid: string) => {
        setLoading(true);
        try {
            const [profile, userOrders] = await Promise.all([
                getUserProfile(uid),
                getUserOrders(uid),
            ]);
            setProfileData(profile);
            setOrders(userOrders);
            setEditName(profile?.displayName || currentUser?.displayName || '');
            setEditPhone(profile?.phone || '');
            setEditAddress(profile?.address || '');
        } catch (e) {
            console.error('Failed to load member data:', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isEditing) {
            setGeocodeResult(null);
            setGeocodeError('');
            setVerifiedFor('');
        }
    }, [isEditing]);

    const addressChangedSinceProfile = editAddress.trim() !== (profileData?.address || '').trim();
    const addressChangedSinceVerify = !!geocodeResult && editAddress.trim() !== verifiedFor;
    const profileNeedsInitialVerify = !profileData?.addressVerifiedText || (profileData?.addressVerifiedText || '').trim() !== (profileData?.address || '').trim();
    const needsGeocode = (addressChangedSinceProfile || profileNeedsInitialVerify) && (!geocodeResult || addressChangedSinceVerify);

    const handleVerifyAddress = async () => {
        if (!currentUser) return;
        if (!editAddress || editAddress.trim().length < 10) {
            setGeocodeError(t.addressErrorMinLength);
            return;
        }
        setGeocoding(true);
        setGeocodeError('');
        setGeocodeResult(null);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ address: editAddress.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setGeocodeError(data.error || t.addressErrorGeneric);
                return;
            }
            setGeocodeResult(data);
            setVerifiedFor(editAddress.trim());
        } catch (e) {
            setGeocodeError(e instanceof Error ? e.message : t.addressErrorNetwork);
        }
        setGeocoding(false);
    };

    const handleUpdateProfile = async () => {
        if (!currentUser) return;
        if (!editName || !editPhone || !editAddress) return alert(t.fillAllFields);
        if (needsGeocode) {
            setGeocodeError(t.confirmAddressFirst);
            return;
        }
        setSaving(true);
        try {
            const { updateUserProfile } = await import('@/lib/auth');
            const { updateProfile } = await import('firebase/auth');
            const { serverTimestamp } = await import('firebase/firestore');

            await updateProfile(currentUser, { displayName: editName });

            const updateData: any = {
                displayName: editName,
                phone: editPhone,
                address: editAddress,
            };
            if (geocodeResult) {
                updateData.addressLat = geocodeResult.lat;
                updateData.addressLng = geocodeResult.lng;
                updateData.addressDistanceKm = geocodeResult.distanceKm;
                updateData.deliveryZone = geocodeResult.zone;
                updateData.addressFormatted = geocodeResult.formattedAddress;
                updateData.addressVerifiedAt = serverTimestamp();
                updateData.addressVerifiedText = editAddress.trim();
            }
            await updateUserProfile(currentUser.uid, updateData);

            if (geocodeResult) {
                const { claimReferralVoucher } = await import('@/lib/auth');
                const claimed = await claimReferralVoucher(currentUser);
                if (claimed?.voucherCode) {
                    alert(t.referralRewardSuccess(claimed.voucherCode));
                    loadMyVouchers(currentUser);
                } else if (claimed?.rejectedReason) {
                    alert(t.referralRewardRejected(claimed.rejectedReason));
                }
            }

            setProfileData((prev: any) => ({
                ...prev,
                displayName: editName,
                phone: editPhone,
                address: editAddress,
                ...(geocodeResult ? {
                    addressLat: geocodeResult.lat,
                    addressLng: geocodeResult.lng,
                    addressDistanceKm: geocodeResult.distanceKm,
                    deliveryZone: geocodeResult.zone,
                    addressFormatted: geocodeResult.formattedAddress,
                    addressVerifiedText: editAddress.trim(),
                } : {}),
            }));
            setIsEditing(false);
        } catch (error) {
            alert(t.saveFailed);
        }
        setSaving(false);
    };

    if (authChecked && !currentUser) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🔐</div>
                    <h1 className="text-2xl font-black text-[#1A2D23]">{t.memberCenter}</h1>
                    <p className="text-gray-500 text-sm">{t.pleaseLoginFirst}</p>
                    <Link href={homeHref} className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                        <ArrowLeft size={16} /> {t.loginReturnHome}
                    </Link>
                </div>
            </div>
        );
    }

    if (!authChecked || loading) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);
    const pagedOrders = orders.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE);

    const memberDays = profileData?.createdAt?.seconds
        ? Math.floor((Date.now() / 1000 - profileData.createdAt.seconds) / 86400)
        : 0;
    const pointsProgress = Math.min(((profileData?.points || 0) / 100) * 100, 100);

    const referralCode = profileData?.referralCode || ('IB-' + (currentUser?.uid?.slice(0, 6).toUpperCase() || 'XXXXXX'));
    const shareText = t.referralShareText(referralCode);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const handleCopyShareText = () => {
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const dishCount: Record<string, number> = {};
    orders.forEach((o: any) => {
        o.items?.forEach((item: any) => {
            dishCount[item.name] = (dishCount[item.name] || 0) + item.quantity;
        });
    });
    const favDish = Object.entries(dishCount).sort((a, b) => b[1] - a[1])[0];
    const favDishItem = favDish
        ? orders.flatMap((o: any) => o.items || []).find((it: any) => it?.name === favDish[0])
        : undefined;
    const favDishImage = resolveDishImage(favDishItem) || (favDish ? LEGACY_DISH_IMAGES[favDish[0]] : null);

    const handleReorder = (order: any) => {
        const items = order.items?.map((item: any) => `${item.name} x${item.quantity}`).join('\n') || '';
        const msg = `${t.reorderWaPrefix}\n\n${items}\n\n${t.reorderWaTotal((order.total || 0).toFixed(2))}\n${t.reorderWaAddress(order.userAddress || '')}\n\n${t.reorderWaThanks}`;
        window.open(`https://wa.me/60103370197?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-40 -left-20 w-72 h-72 bg-[#FF6B35]/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-40 -right-20 w-96 h-96 bg-[#1A2D23]/5 rounded-full blur-[120px]" />
            </div>
            <style jsx global>{`

                body { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
            `}</style>

            {/* Header */}
            <header className="bg-gradient-to-br from-[#1A2D23] via-[#21352A] to-[#12221A] text-white pb-28 pt-8 px-4 relative overflow-hidden shadow-2xl shadow-[#1A2D23]/10">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B35]/20 rounded-full blur-[80px] mix-blend-screen" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#E3EADA]/10 rounded-full blur-[60px] mix-blend-screen" />
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[length:24px_24px]"></div>
                </div>
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-10 left-10 text-8xl transform -rotate-12">🍜</div>
                    <div className="absolute bottom-10 right-10 text-7xl transform rotate-12">🥢</div>
                </div>
                <div className="max-w-2xl mx-auto relative">
                    <div className="flex items-center justify-between mb-8">
                        <Link href={homeHref} className="group flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/10 text-white/90 text-sm font-bold transition-all active:scale-95 shadow-lg shadow-black/10">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span>{t.backHome}</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <LanguageSwitcher current={locale} />
                            <button
                                onClick={async () => { await logout(); window.location.href = homeHref; }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 backdrop-blur-md rounded-2xl border border-red-500/20 text-red-100/80 hover:text-red-100 text-xs font-bold transition-all active:scale-95 shadow-lg shadow-black/10"
                            >
                                <LogOut size={14} /> {t.logout}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FF6B35] to-[#FF8F60] p-1.5 shadow-2xl rotate-3">
                                <div className="w-full h-full rounded-[24px] bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden -rotate-3">
                                    {currentUser?.photoURL ? (
                                        <Image src={currentUser.photoURL} alt="avatar" width={80} height={80} className="object-cover" />
                                    ) : (
                                        <span className="text-4xl font-black text-white/90">{(currentUser?.displayName || 'G')[0].toUpperCase()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-3xl font-black tracking-tight">{currentUser?.displayName || t.defaultGreeting}</h1>
                                <div className="flex items-center gap-2 text-white/50 text-[10px] font-bold uppercase tracking-widest">
                                    <Clock size={10} /> {t.daysJoined(memberDays)}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/10 text-white transition-all active:scale-90 flex items-center gap-2"
                        >
                            <Settings size={20} className="opacity-70" />
                            <span className="text-xs font-bold">{t.editProfile}</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 -mt-20 relative z-10 space-y-6 pb-12">
                {/* Points Card */}
                <div className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-6 shadow-xl shadow-black/5 border border-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#FF6B35]/10 rounded-xl flex items-center justify-center">
                                <Sparkles size={16} className="text-[#FF6B35]" />
                            </div>
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.myPoints}</span>
                        </div>
                        <span className="text-3xl font-black text-[#FF6B35]">{profileData?.points || 0}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                        <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F60] h-3 rounded-full transition-all duration-700" style={{ width: `${pointsProgress}%` }}></div>
                    </div>

                    {(profileData?.points || 0) >= 100 ? (
                        <div className="mt-3">
                            {!redeemedCode ? (
                                <div className="bg-gradient-to-br from-[#FFF3E0] via-[#FFECB3] to-[#FFE0B2] rounded-2xl p-5 border border-[#FFD54F]/50 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF6B35]/10 rounded-full blur-2xl" />
                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#FFD54F]/20 rounded-full blur-xl" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-2xl shadow-sm animate-bounce">
                                                🎁
                                            </div>
                                            <div>
                                                <p className="font-black text-[#E65100] text-sm">{t.pointsThresholdReached}</p>
                                                <p className="text-[11px] text-[#E65100]/60">{t.pointsThresholdSubtitle}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleRedeemPoints}
                                            disabled={redeeming}
                                            className="w-full py-3.5 bg-[#FF6B35] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E95D31] transition-all shadow-lg shadow-[#FF6B35]/30 active:scale-[0.98]"
                                        >
                                            <Sparkles size={16} />
                                            {redeeming ? t.redeeming : t.redeemNow}
                                        </button>
                                        <p className="text-[10px] text-[#E65100]/40 text-center mt-2">{t.pointsAfterRedeem(Math.max(0, (profileData?.points || 0) - 100))}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full blur-2xl" />
                                    <div className="relative z-10 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                <CheckCircle size={18} className="text-green-600" />
                                            </div>
                                            <p className="font-black text-green-700 text-sm">{t.redeemSuccess}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-green-200 text-center">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{t.yourCode}</p>
                                            <p className="font-mono font-black text-2xl text-[#FF6B35] tracking-[0.15em] mb-2">{redeemedCode}</p>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(redeemedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                                className="px-5 py-2 bg-[#1A2D23] text-white rounded-lg text-xs font-bold hover:bg-[#2A3D33] transition-colors"
                                            >
                                                {copied ? `✅ ${t.copied}` : `📋 ${t.copyCode}`}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-green-600/70 text-center">{t.pasteCodeHint}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-400">{t.pointsNeedMore(Math.max(100 - (profileData?.points || 0), 0))}</p>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <ShoppingBag size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{profileData?.totalOrders || 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsTotalOrders}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Wallet size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23] truncate">RM{(profileData?.totalSpent || 0).toFixed(0)}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsTotalSpent}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Star size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{favDish ? favDish[1] : 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsFavCount}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Calendar size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{memberDays}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsDaysJoined}</p>
                    </div>
                </div>

                {/* Favorite Dish Badge with real image */}
                {favDish && (
                    <div className="bg-gradient-to-r from-[#FFF3E0] to-[#FFECB3] rounded-2xl p-4 flex items-center gap-4 border border-[#FFE0B2] overflow-hidden">
                        {favDishImage ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0 shadow-md">
                                <Image src={favDishImage} alt={favDish[0]} fill className="object-cover" />
                            </div>
                        ) : (
                            <span className="text-4xl shrink-0">👩‍🍳</span>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[#E65100] uppercase tracking-wider">{t.favDishLabel}</p>
                            <p className="font-black text-[#1A2D23] truncate">{favDish[0]}</p>
                            <p className="text-xs text-[#E65100]/60">{t.favDishOrderCount(favDish[1])}</p>
                        </div>
                    </div>
                )}

                {/* Order History */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-lg shadow-black/5 border border-white overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white/50">
                        <h2 className="font-black text-[#1A2D23] flex items-center gap-2">
                            <ShoppingBag size={18} /> {t.orderHistory}
                        </h2>
                        <span className="text-xs text-gray-400 font-bold">{t.orderCountSuffix(orders.length)}</span>
                    </div>

                    {orders.length === 0 ? (
                        <div className="text-center py-16 text-gray-300">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-bold text-sm">{t.noOrders}</p>
                            <Link href={homeHref} className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">
                                {t.goOrder}
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-50">
                                {pagedOrders.map((order: any) => {
                                    const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                                    const StIcon = st.icon;
                                    const isExpanded = expandedOrder === order.id;
                                    const mainItem = order.items?.[0];
                                    const mainDish = mainItem?.name || '—';
                                    const mainDishImage = resolveDishImage(mainItem);
                                    const itemCount = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

                                    return (
                                        <div key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                            <button
                                                className="w-full p-4 flex items-center gap-3 text-left"
                                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                            >
                                                <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 bg-[#F5F3EF]">
                                                    {mainDishImage ? (
                                                        <Image src={mainDishImage} alt={mainDish} fill className="object-cover" />
                                                    ) : (
                                                        <span className="text-2xl absolute inset-0 flex items-center justify-center">🍛</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${st.color}`}>
                                                            <StIcon size={9} /> {st.label}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-[#1A2D23] text-sm truncate">
                                                        {mainDish} {itemCount > 1 && <span className="text-gray-400 font-normal">{t.orderItemSuffix(itemCount)}</span>}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">📅 {order.deliveryDate}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <p className="font-black text-[#FF6B35]">RM {(order.total || 0).toFixed(2)}</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReorder(order); }}
                                                        className="px-3 py-1 bg-[#FF6B35] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-[#E95D31] transition-colors shadow-sm"
                                                    >
                                                        <RefreshCw size={10} /> {t.reorder}
                                                    </button>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200 space-y-3">
                                                    <div className="bg-[#F5F3EF] rounded-xl p-3 space-y-1">
                                                        {order.items?.map((item: any, i: number) => (
                                                            <div key={i} className="flex justify-between text-xs">
                                                                <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                                                <span className="font-bold text-gray-700">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                                                        <span>⏰ {order.deliveryTime?.split('(')[0]?.trim()}</span>
                                                        <span>📍 {order.userAddress?.slice(0, 30)}{order.userAddress?.length > 30 ? '...' : ''}</span>
                                                    </div>
                                                    {order.note && (
                                                        <p className="text-[10px] text-[#FF6B35] font-bold">📝 {order.note}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-2 rounded-lg bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-gray-400">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-2 rounded-lg bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Meal Voucher Wallet */}
                <div className="bg-gradient-to-br from-[#FFF3E0] via-white to-[#FFE9D5] rounded-[32px] p-6 shadow-md border border-[#FFD6B0]/60 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF6B35]/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FFD54F]/15 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-lg text-[#1A2D23] flex items-center gap-2">
                                <Ticket size={18} className="text-[#FF6B35]" />
                                {t.mealVoucherWallet}
                            </h3>
                            {mealVoucherInfo && mealVoucherInfo.availableCount > 0 && (
                                <span className="text-[10px] text-[#1A2D23]/50 font-bold">{t.mealVouchersAvailable(mealVoucherInfo.availableCount)}</span>
                            )}
                        </div>

                        {!mealVoucherInfo || mealVoucherInfo.availableCount === 0 ? (
                            <div className="bg-white/70 backdrop-blur-md border border-dashed border-[#FFD6B0] rounded-2xl px-4 py-5 text-center">
                                <p className="text-sm text-[#1A2D23]/70 font-bold mb-1">{t.noMealVouchers}</p>
                                <p className="text-[11px] text-[#1A2D23]/50 leading-relaxed mb-4">
                                    {t.mealVoucherTagline}
                                </p>
                                <Link
                                    href="/meal-vouchers"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white rounded-xl text-xs font-bold hover:bg-[#E95D31] transition-colors shadow-md shadow-[#FF6B35]/20"
                                >
                                    <Ticket size={14} /> {t.buyMealVoucher}
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm">
                                    <div className="flex items-baseline justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-[#1A2D23]/50 uppercase tracking-wider">{t.availableMealVouchers}</p>
                                            <p className="text-3xl font-black text-[#FF6B35] leading-none mt-1">{mealVoucherInfo.availableCount}</p>
                                            <p className="text-[10px] text-[#1A2D23]/40 mt-1">{t.voucherEqualsMeal}</p>
                                        </div>
                                        {mealVoucherInfo.soonestDaysLeft !== null && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-[#1A2D23]/50 uppercase tracking-wider">{t.soonestExpiry}</p>
                                                <p className="text-xl font-black text-[#1A2D23] mt-1">
                                                    {mealVoucherInfo.soonestDaysLeft}
                                                    <span className="text-xs font-bold text-[#1A2D23]/50 ml-1">{t.daysUnit}</span>
                                                </p>
                                                {mealVoucherInfo.soonestDaysLeft <= 7 && (
                                                    <p className="text-[10px] text-red-500 font-bold mt-0.5">{t.expiringSoon}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 px-3 py-2 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2]">
                                        <p className="text-[11px] text-[#E65100] font-bold flex items-center gap-1.5">
                                            <Sparkles size={12} /> {t.redeemAtCheckoutHint}
                                        </p>
                                    </div>
                                </div>

                                <Link
                                    href="/meal-vouchers"
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-[#FF6B35] text-[#FF6B35] rounded-xl text-xs font-bold hover:bg-[#FF6B35] hover:text-white transition-colors"
                                >
                                    <Plus size={14} strokeWidth={3} /> {t.buyMore}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* My Vouchers */}
                <div className="bg-white rounded-[32px] p-6 shadow-md border border-[#E3EADA]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-lg text-[#1A2D23] flex items-center gap-2">
                            <Sparkles size={18} className="text-[#FF6B35]" />
                            {t.myVouchers}
                        </h3>
                        <span className="text-xs text-[#1A2D23]/50 font-bold">{t.voucherCountSuffix(myVouchers.length)}</span>
                    </div>
                    {myVouchers.length === 0 ? (
                        <div className="bg-[#FDFBF7] border border-dashed border-[#E3EADA] rounded-xl px-4 py-6 text-center">
                            <p className="text-sm text-[#1A2D23]/60 font-bold mb-1">{t.noPromoVouchers}</p>
                            <p className="text-[11px] text-[#1A2D23]/50 leading-relaxed">
                                {t.noPromoVouchersLine1}<br />
                                {t.noPromoVouchersLine2}
                            </p>
                        </div>
                    ) : (
                        <>
                        <div className="space-y-2.5">
                            {myVouchers.map((v) => {
                                const isReferral = v.source === 'referral';
                                const isPoints = v.source === 'points-redemption';
                                const labelText = isReferral ? t.voucherLabelReferral : isPoints ? t.voucherLabelPoints : t.voucherLabelGeneric;
                                const accent = isReferral ? '#FF6B35' : isPoints ? '#2D5F3E' : '#C9A24E';
                                return (
                                    <div
                                        key={v.code}
                                        className="flex items-stretch border border-dashed rounded-xl overflow-hidden"
                                        style={{ borderColor: accent }}
                                    >
                                        <div
                                            className="flex flex-col items-center justify-center px-4 py-3 text-white shrink-0"
                                            style={{ backgroundColor: accent, minWidth: '90px' }}
                                        >
                                            <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">RM</p>
                                            <p className="text-2xl font-black leading-none">{v.discount}</p>
                                            <p className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">{t.voucherDiscountLabel}</p>
                                        </div>
                                        <div className="flex-1 p-3 flex items-center justify-between gap-2 bg-[#FDFBF7]">
                                            <div className="min-w-0">
                                                <p className="font-mono font-black text-sm text-[#1A2D23] truncate">{v.code}</p>
                                                <p className="text-[10px] font-bold mt-0.5" style={{ color: accent }}>{labelText}</p>
                                                <p className="text-[10px] text-[#1A2D23]/50 mt-0.5">
                                                    {t.voucherDaysLeft(v.daysLeft)}
                                                    {v.daysLeft <= 7 && <span className="text-red-500 font-bold ml-1">{t.voucherExpiringSoon}</span>}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleCopyVoucher(v.code)}
                                                className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${copiedVoucher === v.code ? 'bg-green-500 text-white' : 'bg-[#1A2D23]/5 text-[#1A2D23] hover:bg-[#1A2D23]/10'}`}
                                            >
                                                {copiedVoucher === v.code ? <><CheckCircle size={11} /> {t.voucherCopied}</> : <><Copy size={11} /> {t.voucherCopy}</>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-[#1A2D23]/40 mt-3 text-center">{t.pasteVoucherHint}</p>
                        </>
                    )}
                </div>

                {/* Referral Section */}
                <div className="bg-gradient-to-br from-[#1A2D23] via-[#21352A] to-[#12221A] rounded-[32px] p-6 text-white shadow-2xl shadow-[#1A2D23]/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B35]/20 rounded-full blur-[50px] mix-blend-screen pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#E3EADA]/10 rounded-full blur-[40px] mix-blend-screen pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Share2 size={18} className="text-[#FF6B35]" />
                            <h3 className="font-black text-lg">{t.referFriends}</h3>
                        </div>
                        <p className="text-white/70 text-xs mb-5 leading-relaxed">
                            {t.referBlurbBeforeBonus}<span className="text-[#FF6B35] font-black">{t.referBonusVoucher}</span>{t.referBlurbMid}<span className="text-[#FF6B35] font-black">{t.referBonusPoints}</span>{t.referBlurbAfterBonus}
                        </p>

                        <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">{t.referralCodeLabel}</p>
                                <p className="text-2xl font-black tracking-[0.3em] text-[#FF6B35]">{referralCode}</p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <button
                                    onClick={handleCopyCode}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                                >
                                    {copied ? <><CheckCircle size={11} /> {t.copied}</> : <><Copy size={11} /> {t.copyCodeBtn}</>}
                                </button>
                                <button
                                    onClick={handleCopyShareText}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 bg-white/10 text-white/80 hover:bg-white/20 transition-all"
                                >
                                    <Share2 size={11} /> {t.copyCopyText}
                                </button>
                            </div>
                        </div>

                        {referralStats && referralStats.referredCount > 0 ? (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <p className="text-2xl font-black text-white">{referralStats.referredCount}</p>
                                        <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-1">{t.statFriendsRegistered}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-green-400">{referralStats.confirmedCount}</p>
                                        <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-1">{t.statFirstOrders}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-[#FF6B35]">+{referralStats.pointsEarned}</p>
                                        <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-1">{t.statPointsEarned}</p>
                                    </div>
                                </div>
                                {referralStats.pendingCount > 0 && (
                                    <p className="text-[11px] text-amber-300/80 mt-3 text-center">
                                        {t.pendingFriendsReminder(referralStats.pendingCount)}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                                <p className="text-xs text-white/50 leading-relaxed">
                                    {t.referEmptyHint}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Profile Modal */}
                {isEditing && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !saving && setIsEditing(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-[#1A2D23] p-6 text-white text-center relative">
                                <div className="absolute top-6 right-6">
                                    <button onClick={() => setIsEditing(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
                                </div>
                                <div className="w-16 h-16 bg-[#FF6B35] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FF6B35]/20">
                                    <Settings size={32} className="text-white" />
                                </div>
                                <h3 className="text-xl font-black">{t.updateProfile}</h3>
                                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">{t.updateMemberInfoSub}</p>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <UserIcon size={10} strokeWidth={3} /> {t.fieldName}
                                        </label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder={t.placeholderName}
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-[#FF6B35] focus:bg-white transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <Phone size={10} strokeWidth={3} /> {t.fieldPhone}
                                        </label>
                                        <input
                                            type="tel"
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            placeholder={t.placeholderPhone}
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-[#FF6B35] focus:bg-white transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <MapPin size={10} strokeWidth={3} /> {t.fieldAddress}
                                        </label>
                                        <textarea
                                            value={editAddress}
                                            onChange={(e) => setEditAddress(e.target.value)}
                                            placeholder={t.placeholderAddress}
                                            rows={3}
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-[#FF6B35] focus:bg-white transition-all font-medium resize-none"
                                        />

                                        <button
                                            type="button"
                                            onClick={handleVerifyAddress}
                                            disabled={geocoding || !editAddress.trim()}
                                            className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                                                geocoding || !editAddress.trim()
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'
                                            }`}
                                        >
                                            {geocoding ? <><Loader2 size={14} className="animate-spin" /> {t.verifying}</> : t.verifyAddressBtn}
                                        </button>

                                        {geocodeError && (
                                            <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-start gap-1.5">
                                                <AlertCircle size={12} className="mt-0.5 shrink-0" /> {geocodeError}
                                            </div>
                                        )}

                                        {geocodeResult && !addressChangedSinceVerify && (() => {
                                            const createdAtSec = profileData?.createdAt?.seconds;
                                            const isExistingCustomer =
                                                typeof createdAtSec === 'number' && createdAtSec * 1000 < PRICING_V2_CUTOFF_MS;
                                            const tier: DeliveryTier =
                                                isExistingCustomer && geocodeResult.distanceKm <= FREE_DELIVERY_RADIUS_KM
                                                    ? 'free'
                                                    : tierFromDistance(geocodeResult.distanceKm);
                                            const tierStyles: Record<DeliveryTier, string> = {
                                                free: 'bg-green-50 border-green-200 text-green-700',
                                                near: 'bg-amber-50 border-amber-200 text-amber-700',
                                                mid: 'bg-orange-50 border-orange-200 text-orange-700',
                                                far: 'bg-red-50 border-red-200 text-red-700',
                                            };
                                            return (
                                                <div className={`mt-2 px-3 py-2.5 rounded-lg text-xs border ${tierStyles[tier]}`}>
                                                    <p className="font-black flex items-center gap-1.5">
                                                        <CheckCircle size={12} />
                                                        {tierLabel(tier)} · {t.distanceFromPearlPoint(geocodeResult.distanceKm)}
                                                    </p>
                                                    <p className="text-[10px] mt-1 opacity-80 leading-snug">
                                                        {tier === 'free' ? t.allOrdersFreeShipping : tierFeeHint(tier)}
                                                    </p>
                                                    {geocodeResult.partialMatch && tier !== 'free' && (
                                                        <p className="text-[10px] mt-1 opacity-70 italic">
                                                            {t.partialMatchWarning(geocodeResult.distanceKm)}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        {addressChangedSinceVerify && (
                                            <p className="mt-1 text-[10px] text-amber-600 font-bold">{t.addressChangedReverify}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={saving || needsGeocode}
                                    className="w-full py-4 bg-[#FF6B35] text-white rounded-[20px] font-black shadow-lg shadow-[#FF6B35]/20 hover:bg-[#E95D31] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : needsGeocode ? (
                                        <><AlertCircle size={18} /> {t.confirmAddressFirstBtn}</>
                                    ) : (
                                        <><Save size={18} /> {t.saveProfile}</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    disabled={saving}
                                    className="w-full py-3 text-gray-400 text-xs font-bold uppercase tracking-widest hover:text-gray-600 transition-colors"
                                >
                                    {t.cancel}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
