"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, logout } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import { ArrowLeft, Star, ShoppingBag, Wallet, Calendar, Clock, CheckCircle, ChefHat, Truck, XCircle, Sparkles, ChevronLeft, ChevronRight, RefreshCw, LogOut, Settings, Phone, MapPin, Save, X, User as UserIcon, Loader2, AlertCircle, Ticket, Plus } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';
import AddressBook from '@/components/auth/AddressBook';
import LanguageSwitcher from '@/components/home/LanguageSwitcher';
import dynamic from 'next/dynamic';
// 未登录 gate 里的页内登录弹窗。ssr:false —— AuthModal 依赖 Firebase Auth。
const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
import { useCartStore } from '@/store/cartStore';
import { weeklyMenu } from '@/data/weeklyMenu';
import { computeMenuDates } from '@/lib/dateUtils';

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
    // 只接受真实图片路径；新菜可能先用 emoji 占位（如「🍲」），此时回退到 emoji 缩略图而非塞进 next/image。
    if (item.image && item.image.startsWith('/')) return item.image;
    if (item.name && LEGACY_DISH_IMAGES[item.name]) return LEGACY_DISH_IMAGES[item.name];
    return null;
};

// EN 版历史订单菜名兜底：老订单没存 items[].nameEn，按中文名反查当前菜单表
// （weeklyMenu 含 retired 菜，旧菜也能命中）；加料行（↳ 前缀）查不到就保留中文。
const DISH_NAME_EN: Record<string, string> = Object.fromEntries(
    weeklyMenu.map(d => [d.name, d.nameEn])
);

const ORDERS_PER_PAGE = 5;

export default function MemberView({ locale }: { locale: Locale }) {
    const t = MEMBER_DICT[locale];
    const tierLabel = locale === 'en' ? tierLabelEn : tierLabelZh;
    const tierFeeHint = locale === 'en' ? tierFeeHintEn : tierFeeHintZh;
    const homeHref = locale === 'en' ? '/en' : '/';

    // 渲染层菜名：EN 优先订单自带 nameEn，缺失时按中文名反查菜单表；ZH 原样不动。
    const itemName = (item: { name?: string; nameEn?: string } | undefined): string => {
        if (!item?.name) return '';
        if (locale !== 'en') return item.name;
        const isAddOn = item.name.startsWith('↳');
        if (item.nameEn) return isAddOn ? `↳ ${item.nameEn}` : item.nameEn;
        return DISH_NAME_EN[item.name] || item.name;
    };

    const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
        pending: { label: t.statusPending, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
        confirmed: { label: t.statusConfirmed, color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
        preparing: { label: t.statusPreparing, color: 'bg-purple-100 text-purple-700', icon: ChefHat },
        delivered: { label: t.statusDelivered, color: 'bg-green-100 text-green-700', icon: Truck },
        cancelled: { label: t.statusCancelled, color: 'bg-red-100 text-red-700', icon: XCircle },
    };

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    // 地址簿切换/删除后要同步刷新 AuthProvider 的缓存（购物车读那份）
    const { refreshProfile: refreshGlobalProfile } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [saving, setSaving] = useState(false);
    // 表单级提示（资料不全 / 保存失败）：单 state 承接所有分支，贴「确认保存」按钮内联显示。
    // 取代原来的 alert —— 手机上 alert 顶着域名前缀、冻结整页、文字还选不中。
    const [formError, setFormError] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<{ lat: number; lng: number; distanceKm: number; zone: DeliveryZone; formattedAddress: string; partialMatch: boolean } | null>(null);
    const [geocodeError, setGeocodeError] = useState('');
    // 「用我的当前位置」：只回填地址串，不参与验证/存档（见 handleUseMyLocation）
    const [locating, setLocating] = useState(false);
    const [locateNotice, setLocateNotice] = useState('');
    const [verifiedFor, setVerifiedFor] = useState('');
    // 'loading' = 还在拉；'error' = 拉失败（以前被 catch 吞掉，界面显示成「你没有餐券」）；
    // 'ok' = 拿到了（数量可能是 0）。三态分开，别再让加载失败冒充空钱包。
    const [voucherLoad, setVoucherLoad] = useState<'loading' | 'error' | 'ok'>('loading');
    const [mealVoucherInfo, setMealVoucherInfo] = useState<{
        availableCount: number;
        soonestDaysLeft: number | null;
        expirySchedule: { date: string; count: number }[];
        recentPurchases: { id: string; bundleId: string; voucherCount: number; amountPaid: number; status: string; createdAtMs: number }[];
        addonCredits: { addonId: string; addonName: string; remaining: number; soonestExpiryMs: number | null }[];
    } | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            setAuthChecked(true);
            if (user) {
                loadData(user.uid);
                loadMealVouchers(user);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadMealVouchers = async (user: User) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/my-meal-vouchers', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { setVoucherLoad('error'); return; }
            const data = await res.json();
            setMealVoucherInfo({
                availableCount: data.availableCount || 0,
                soonestDaysLeft: data.soonestDaysLeft ?? null,
                expirySchedule: data.expirySchedule || [],
                recentPurchases: data.recentPurchases || [],
                addonCredits: Array.isArray(data.addonCredits) ? data.addonCredits : [],
            });
            setVoucherLoad('ok');
        } catch (e) {
            console.warn('Failed to load meal vouchers:', e);
            setVoucherLoad('error');
        }
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
            setFormError('');
        }
    }, [isEditing]);

    // 地址簿的 onReload：拉权威 profile 回本页 state + 刷全局缓存
    const reloadProfileOnly = async () => {
        if (!currentUser) return;
        const p = await getUserProfile(currentUser.uid);
        setProfileData(p);
        setEditAddress(p?.address || '');
        await refreshGlobalProfile();
    };

    const addressChangedSinceProfile = editAddress.trim() !== (profileData?.address || '').trim();
    const addressChangedSinceVerify = !!geocodeResult && editAddress.trim() !== verifiedFor;
    const profileNeedsInitialVerify = !profileData?.addressVerifiedText || (profileData?.addressVerifiedText || '').trim() !== (profileData?.address || '').trim();
    const needsGeocode = (addressChangedSinceProfile || profileNeedsInitialVerify) && (!geocodeResult || addressChangedSinceVerify);

    /**
     * 「用我的当前位置」—— 与 AuthProfileView 同一套：GPS 只负责回填地址串，
     * 距离/运费仍由「确认地址」走服务端 geocode 权威解析（/api/geocode 的反查
     * 分支只回 formattedAddress，不回坐标/距离，所以不构成骗免运的新口子）。
     */
    const handleUseMyLocation = () => {
        if (!currentUser) return;
        setGeocodeError('');
        setLocateNotice('');
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeocodeError(t.locateUnsupported);
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const token = await currentUser.getIdToken();
                    const res = await fetch('/api/geocode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.formattedAddress) {
                        setGeocodeError(data.error || t.locateFailed);
                        return;
                    }
                    setEditAddress(data.formattedAddress);
                    setGeocodeResult(null);
                    setVerifiedFor('');
                    setLocateNotice(t.locateFilled);
                } catch {
                    setGeocodeError(t.addressErrorNetwork);
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                setGeocodeError(err.code === err.PERMISSION_DENIED ? t.locateDenied : t.locateFailed);
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
    };

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
        setFormError(''); // 每次点保存先清掉上一轮的提示
        if (!editName || !editPhone || !editAddress) {
            setFormError(t.fillAllFields);
            return;
        }
        if (needsGeocode) {
            setGeocodeError(t.confirmAddressFirst);
            return;
        }
        setSaving(true);
        try {
            const { updateUserProfile } = await import('@/lib/auth');
            const { updateProfile } = await import('firebase/auth');

            await updateProfile(currentUser, { displayName: editName });

            if (geocodeResult) {
                // 🔒 2026-09-05（A2）：地址相关字段一律走 saveDeliveryProfile →
                // /api/save-address 由服务端重新 geocode 后落库（含 phone、地址簿收编）。
                // 以前这里自己拼了一份 updateUserProfile 写 lat / distanceKm / zone，
                // 和 lib/deliveryProfile 是两份真相，也是客户端自写距离的入口之一。
                const { saveDeliveryProfile } = await import('@/lib/deliveryProfile');
                await saveDeliveryProfile({
                    uid: currentUser.uid,
                    isAnonymous: currentUser.isAnonymous,
                    phone: editPhone,
                    address: editAddress,
                    geocode: geocodeResult,
                    guestName: currentUser.isAnonymous ? editName : undefined,
                });
                await updateUserProfile(currentUser.uid, { displayName: editName });
            } else {
                // 地址没动（needsGeocode 为 false）：只改称呼和手机，不碰地址字段 ——
                // rules 收紧后客户端写 address 会被拒。
                await updateUserProfile(currentUser.uid, { displayName: editName, phone: editPhone });
            }

            // 重拉权威 profile 而不是手动拼本地 state —— 手动拼漏掉
            // savedAddresses，地址簿要刷新页面才更新；重拉顺带同步
            // AuthProvider 全局缓存（购物车读那份）。
            await reloadProfileOnly();
            setIsEditing(false);
        } catch (error) {
            console.error('[member] profile save failed:', error);
            setFormError(t.saveFailed);
        }
        setSaving(false);
    };

    if (authChecked && !currentUser) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🔐</div>
                    <h1 className="text-2xl font-black text-ink">{t.memberCenter}</h1>
                    <p className="text-gray-500 text-sm">{t.pleaseLoginFirst}</p>
                    {/* 2026-09-05：主行动改成**页内登录**。原来只有「返回首页登录」——
                        人被赶回首页自己找入口，登录完还得再走回来。 */}
                    <button
                        onClick={() => setAuthOpen(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
                    >
                        {t.signInHere}
                    </button>
                    <Link href={homeHref} className="inline-flex items-center gap-2 px-4 py-2 text-ink/60 rounded-xl font-bold text-sm hover:text-ink transition-colors">
                        <ArrowLeft size={16} /> {t.loginReturnHome}
                    </Link>
                    {authOpen && <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} locale={locale} />}
                </div>
            </div>
        );
    }

    if (!authChecked || loading) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);
    // 订单刷新（下单 / 取消 / 一键回购之后）可能让总页数变少，而 page 还停在
    // 旧页码上 —— 那一页现在是空的。夹回合法范围。
    const safePage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
    const pagedOrders = orders.slice(safePage * ORDERS_PER_PAGE, (safePage + 1) * ORDERS_PER_PAGE);

    const memberDays = profileData?.createdAt?.seconds
        ? Math.floor((Date.now() / 1000 - profileData.createdAt.seconds) / 86400)
        : 0;

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

    // One-tap reorder: refill the cart with this order's dishes (mapped onto the
    // CURRENT weekly rotation — each dish lands on its next orderable date at
    // today's price) and jump to the homepage with the cart drawer open.
    // Items that no longer exist on the menu (rotated out / paused / past
    // cutoff) can't self-serve, so they fall back to the old WhatsApp flow.
    const handleReorder = (order: any) => {
        const { menuDates } = computeMenuDates(weeklyMenu, locale);
        const { addBundle } = useCartStore.getState();
        const added: string[] = [];
        const skipped: string[] = [];

        (order.items || []).forEach((item: any, i: number) => {
            const dish = weeklyMenu.find(d =>
                !d.hidden && !d.retired && (d.name === item.name || (item.nameEn && d.nameEn === item.nameEn))
            );
            const dInfo = dish ? menuDates[dish.id] : undefined;
            if (!dish || !dInfo || dInfo.disabled || !dInfo.actualDate) {
                skipped.push(locale === 'en' ? (item.nameEn || item.name) : item.name);
                return;
            }
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const selectedTime = order.deliveryTime === 'Dinner (5PM-8PM)' ? 'Dinner (5PM-8PM)' : 'Lunch (11AM-1PM)';
            addBundle({
                cartItemId: `${dish.id}-${Date.now()}-${i}`,
                dish,
                dishQty: qty,
                addOns: [],
                selectedDate: dInfo.actualDate,
                selectedTime,
                price: dish.price * qty,
                quantity: 1,
            });
            added.push(locale === 'en' ? dish.nameEn : dish.name);
        });

        if (added.length === 0) {
            // Nothing reorderable this week — old WhatsApp flow as the fallback path.
            const items = order.items?.map((item: any) => `${itemName(item)} x${item.quantity}`).join('\n') || '';
            const msg = `${t.reorderWaPrefix}\n\n${items}\n\n${t.reorderWaTotal((order.total || 0).toFixed(2))}\n${t.reorderWaAddress(order.userAddress || '')}\n\n${t.reorderWaThanks}`;
            window.open(`https://wa.me/60103370197?text=${encodeURIComponent(msg)}`, '_blank');
            return;
        }
        if (skipped.length > 0) {
            // 原来这里弹 alert 列出没加进购物车的菜，客户点掉后立刻跳首页 —— 根本来不及读。
            // 改成把名单交接给下一页：写 sessionStorage，由首页购物车抽屉内联展示。
            // sessionStorage 在无痕/被禁用时会抛错，绝不能挡住跳转。
            try {
                sessionStorage.setItem('incredibowl_reorder_skipped', JSON.stringify(skipped));
            } catch {
                // 存不进就只跳转，退化成「静默不提示」，不影响下单
            }
        }
        window.location.href = `${homeHref}?cart=open`;
    };

    return (
        <div className="min-h-screen bg-paper relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-40 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-40 -right-20 w-96 h-96 bg-ink/5 rounded-full blur-[120px]" />
            </div>
            {/* Header */}
            <header className="bg-gradient-to-br from-ink via-[#21352A] to-[#12221A] text-white pb-28 pt-8 px-4 relative overflow-hidden shadow-2xl shadow-ink/10">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] mix-blend-screen" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-line/10 rounded-full blur-[60px] mix-blend-screen" />
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
                            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-primary to-[#FF8F60] p-1.5 shadow-2xl rotate-3">
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
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-3 sm:p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <ShoppingBag size={18} className="mx-auto mb-1 text-primary" />
                        <p className="text-base sm:text-xl font-black text-ink">{profileData?.totalOrders || 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsTotalOrders}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-3 sm:p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Wallet size={18} className="mx-auto mb-1 text-primary" />
                        <p className="text-base sm:text-xl font-black text-ink whitespace-nowrap">
                            <span className="text-[9px] sm:text-xs font-bold align-text-top mr-0.5 opacity-70">RM</span>{(profileData?.totalSpent || 0).toFixed(0)}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsTotalSpent}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-3 sm:p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Star size={18} className="mx-auto mb-1 text-primary" />
                        <p className="text-base sm:text-xl font-black text-ink">{favDish ? favDish[1] : 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t.statsFavCount}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-3 sm:p-4 text-center shadow-lg shadow-black/5 border border-white">
                        <Calendar size={18} className="mx-auto mb-1 text-primary" />
                        <p className="text-base sm:text-xl font-black text-ink">{memberDays}</p>
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
                            <p className="font-black text-ink truncate">{itemName(favDishItem) || favDish[0]}</p>
                            <p className="text-xs text-[#E65100]/60">{t.favDishOrderCount(favDish[1])}</p>
                        </div>
                    </div>
                )}

                {/* 地址簿：最多 5 个常用地址，切换当前配送地址（逻辑在共享组件）。
                    条件与组件内 null 分支一致，避免空白卡壳。 */}
                {currentUser && !currentUser.isAnonymous
                    && (profileData?.address || (Array.isArray(profileData?.savedAddresses) && profileData.savedAddresses.length > 0)) && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-4 shadow-lg shadow-black/5 border border-white">
                        <AddressBook
                            currentUser={currentUser}
                            profileData={profileData}
                            onReload={reloadProfileOnly}
                            onAddNew={() => { setEditAddress(''); setIsEditing(true); }}
                            locale={locale}
                        />
                    </div>
                )}

                {/* Order History */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-lg shadow-black/5 border border-white overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white/50">
                        <h2 className="font-black text-ink flex items-center gap-2">
                            <ShoppingBag size={18} /> {t.orderHistory}
                        </h2>
                        <span className="text-xs text-gray-400 font-bold">{t.orderCountSuffix(orders.length)}</span>
                    </div>

                    {orders.length === 0 ? (
                        <div className="text-center py-16 text-gray-300">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-bold text-sm">{t.noOrders}</p>
                            <Link href={homeHref} className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors">
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
                                    const mainDish = itemName(mainItem) || '—';
                                    const mainDishImage = resolveDishImage(mainItem);
                                    const itemCount = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

                                    return (
                                        <div key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                            {/* 2026-09-05：这里原来是 <button> 里再套一个「再来一单」<button> ——
                                                非法 HTML（浏览器会把内层甩出外层），移动端点击判定也打架。
                                                改成：整行是 div，展开由左侧那块负责，再来一单是并列的兄弟按钮。 */}
                                            <div className="w-full p-4 flex items-center gap-3 text-left">
                                                <button
                                                    type="button"
                                                    aria-expanded={isExpanded}
                                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
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
                                                    <p className="font-bold text-ink text-sm truncate">
                                                        {mainDish} {itemCount > 1 && <span className="text-gray-400 font-normal">{t.orderItemSuffix(itemCount)}</span>}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">📅 {order.deliveryDate}</p>
                                                </div>
                                                </button>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <p className="font-black text-primary">RM {(order.total || 0).toFixed(2)}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReorder(order)}
                                                        className="min-h-[36px] px-3.5 bg-primary text-white rounded-lg text-[12px] font-bold flex items-center gap-1 hover:bg-primary-dark transition-colors shadow-sm"
                                                    >
                                                        <RefreshCw size={12} /> {t.reorder}
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200 space-y-3">
                                                    <div className="bg-[#F5F3EF] rounded-xl p-3 space-y-1">
                                                        {order.items?.map((item: any, i: number) => (
                                                            <div key={i} className="flex justify-between text-xs">
                                                                <span className="text-gray-600">{itemName(item)} <span className="text-gray-400">x{item.quantity}</span></span>
                                                                <span className="font-bold text-gray-700">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                                                        <span>⏰ {order.deliveryTime?.split('(')[0]?.trim()}</span>
                                                        <span>📍 {order.userAddress?.slice(0, 30)}{order.userAddress?.length > 30 ? '...' : ''}</span>
                                                    </div>
                                                    {order.note && (
                                                        <p className="text-[10px] text-primary font-bold">📝 {order.note}</p>
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
                                        onClick={() => setPage(Math.max(0, safePage - 1))}
                                        disabled={safePage === 0}
                                        className="p-2 rounded-lg bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-gray-400">
                                        {safePage + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                                        disabled={safePage >= totalPages - 1}
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
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FFD54F]/15 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-lg text-ink flex items-center gap-2">
                                <Ticket size={18} className="text-primary" />
                                {t.mealVoucherWallet}
                            </h3>
                            {mealVoucherInfo && mealVoucherInfo.availableCount > 0 && (
                                <span className="text-[10px] text-ink/50 font-bold">{t.mealVouchersAvailable(mealVoucherInfo.availableCount)}</span>
                            )}
                        </div>

                        {voucherLoad === 'loading' ? (
                            <div className="bg-white/70 backdrop-blur-md border border-dashed border-[#FFD6B0] rounded-2xl px-4 py-5 text-center">
                                <div className="h-6 w-24 mx-auto rounded bg-gray-200 animate-pulse" />
                            </div>
                        ) : voucherLoad === 'error' ? (
                            <div className="bg-white/70 backdrop-blur-md border border-dashed border-[#FFD6B0] rounded-2xl px-4 py-5 text-center">
                                <p className="text-sm text-ink/70 font-bold mb-3">{t.voucherLoadFailed}</p>
                                <button
                                    type="button"
                                    onClick={() => { if (currentUser) { setVoucherLoad('loading'); loadMealVouchers(currentUser); } }}
                                    className="inline-flex items-center gap-2 min-h-[40px] px-5 bg-ink text-white rounded-xl text-xs font-bold"
                                >
                                    {t.retry}
                                </button>
                            </div>
                        ) : !mealVoucherInfo || mealVoucherInfo.availableCount === 0 ? (
                            <div className="bg-white/70 backdrop-blur-md border border-dashed border-[#FFD6B0] rounded-2xl px-4 py-5 text-center">
                                <p className="text-sm text-ink/70 font-bold mb-1">{t.noMealVouchers}</p>
                                <p className="text-[11px] text-ink/50 leading-relaxed mb-4">
                                    {t.mealVoucherTagline}
                                </p>
                                <Link
                                    href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors shadow-md shadow-primary/20"
                                >
                                    <Ticket size={14} /> {t.buyMealVoucher}
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm">
                                    <div className="flex items-baseline justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">{t.availableMealVouchers}</p>
                                            <p className="text-3xl font-black text-primary leading-none mt-1">{mealVoucherInfo.availableCount}</p>
                                            <p className="text-[10px] text-ink/40 mt-1">{t.voucherEqualsMeal}</p>
                                        </div>
                                        {mealVoucherInfo.soonestDaysLeft !== null && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">{t.soonestExpiry}</p>
                                                <p className="text-xl font-black text-ink mt-1">
                                                    {mealVoucherInfo.soonestDaysLeft}
                                                    <span className="text-xs font-bold text-ink/50 ml-1">{t.daysUnit}</span>
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
                                    href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-primary text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-colors"
                                >
                                    <Plus size={14} strokeWidth={3} /> {t.buyMore}
                                </Link>
                            </div>
                        )}

                        {/* Prepaid add-on credit balance — independent of voucher count
                            (standalone top-ups exist), auto-applied at checkout */}
                        {mealVoucherInfo && mealVoucherInfo.addonCredits.length > 0 && (
                            <div className="mt-3 bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm">
                                <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">{t.addonCreditsTitle}</p>
                                <div className="mt-2 space-y-1.5">
                                    {mealVoucherInfo.addonCredits.map(c => (
                                        <div key={c.addonId} className="flex justify-between items-center text-xs">
                                            <span className="text-ink/70 font-bold">{c.addonName}</span>
                                            <span className="text-primary font-black">× {c.remaining}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-ink/40 mt-2 flex items-center gap-1.5">
                                    <Sparkles size={10} className="shrink-0" /> {t.addonCreditsAutoHint}
                                    {(() => {
                                        let min: number | null = null;
                                        for (const c of mealVoucherInfo.addonCredits) {
                                            if (typeof c.soonestExpiryMs === 'number' && c.soonestExpiryMs > 0 && (min === null || c.soonestExpiryMs < min)) min = c.soonestExpiryMs;
                                        }
                                        if (min === null) return null;
                                        const days = Math.max(0, Math.ceil((min - Date.now()) / 86_400_000));
                                        return <span> · {t.addonCreditsExpiry(days)}</span>;
                                    })()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Profile Modal */}
                {isEditing && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !saving && setIsEditing(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-ink p-6 text-white text-center relative">
                                <div className="absolute top-6 right-6">
                                    <button onClick={() => setIsEditing(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
                                </div>
                                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
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
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-primary focus:bg-white transition-all font-medium"
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
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-primary focus:bg-white transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <MapPin size={10} strokeWidth={3} /> {t.fieldAddress}
                                        </label>
                                        <textarea
                                            value={editAddress}
                                            onChange={(e) => { setEditAddress(e.target.value); setLocateNotice(''); }}
                                            placeholder={t.placeholderAddress}
                                            rows={3}
                                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-primary focus:bg-white transition-all font-medium resize-none"
                                        />

                                        {/* 一键定位回填 —— 手机上免去拇指打完整地址 */}
                                        <button
                                            type="button"
                                            onClick={handleUseMyLocation}
                                            disabled={locating || geocoding}
                                            className="mt-2 w-full py-2.5 rounded-xl border-2 border-gray-100 bg-white text-ink text-sm font-bold flex items-center justify-center gap-2 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {locating ? <><Loader2 size={14} className="animate-spin" /> {t.locating}</> : t.useMyLocation}
                                        </button>
                                        {locateNotice && (
                                            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800 flex items-start gap-1.5">
                                                <AlertCircle size={12} className="mt-0.5 shrink-0" /> {locateNotice}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleVerifyAddress}
                                            disabled={geocoding || !editAddress.trim()}
                                            className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                                                geocoding || !editAddress.trim()
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-ink text-white hover:bg-[#2A3D33]'
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
                                                        {tier === 'free' ? t.allOrdersFreeShipping : tierFeeHint(tier, geocodeResult.distanceKm)}
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
                                {/* 贴着「确认保存」按钮 —— 客户点完按钮视线就在这里；
                                    不自动消失，留时间读完（尤其保存失败要能重试） */}
                                {formError && (
                                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-start gap-1.5">
                                        <AlertCircle size={12} className="mt-0.5 shrink-0" /> {formError}
                                    </div>
                                )}
                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={saving || needsGeocode}
                                    className="w-full py-4 bg-primary text-white rounded-[20px] font-black shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
