import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Box,
  CircleDot,
  Shield,
  Swords,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Scale,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { soundEngine } from '../../../audio/soundEngine';
import {
  BOTBAY_ITEMS,
  type MarketplaceItem,
  type ItemConditionOption,
  REQUIRED_MECHANICAL_CATEGORIES,
} from '../../../data/marketplaceData';
import {
  type ComponentCategory,
  type PartCondition,
  type PurchasedMechanicalPart,
  type TeamRobotProject,
} from '../../../types/robot';
import { PartArt } from './PartArt';

interface BotBayMarketplaceProps {
  project: TeamRobotProject;
  currentPurchases: Record<string, PurchasedMechanicalPart>;
  onOrderParts: (parts: PurchasedMechanicalPart[]) => void;
  onGoToWorkbench?: () => void;
}

export const BotBayMarketplace: React.FC<BotBayMarketplaceProps> = ({
  project,
  currentPurchases,
  onOrderParts,
  onGoToWorkbench,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionSelections, setConditionSelections] = useState<Record<string, PartCondition>>({});
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const [compareItems, setCompareItems] = useState<[MarketplaceItem | null, MarketplaceItem | null]>([null, null]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Cart state initialized from currentPurchases
  const [cart, setCart] = useState<Record<string, { item: MarketplaceItem; condition: PartCondition }>>(() => {
    const initial: Record<string, { item: MarketplaceItem; condition: PartCondition }> = {};
    Object.values(currentPurchases).forEach((p) => {
      const found = BOTBAY_ITEMS.find((i) => i.category === p.category && i.partId === p.partId);
      if (found) {
        initial[p.category] = { item: found, condition: p.condition };
      }
    });
    return initial;
  });

  // Calculate team funding live from project (re-computes immediately when Business changes!)
  const baseBudgetUsd = project.projectLead.baseBudgetUsd || 1800;
  const sponsorshipUsd = project.projectLead.sponsorshipUsd || 0;
  const sponsorTier = project.projectLead.sponsorTier || 'None';
  const totalAvailableFunding = baseBudgetUsd + sponsorshipUsd;

  // Calculate cart costs
  const cartTotalCost = useMemo(() => {
    return Object.values(cart).reduce((acc, entry) => {
      const price = entry.item.conditions[entry.condition].priceUsd;
      return acc + price;
    }, 0);
  }, [cart]);

  // Estimated weight from cart
  const cartEstimatedWeight = useMemo(() => {
    const partsWeight = Object.values(cart).reduce((acc, entry) => acc + entry.item.weightLb, 0);
    const batteryWeight = project.electrical.batteryId === 'large' ? 4.2 : project.electrical.batteryId === 'small' ? 2.1 : 3.0;
    return Number((partsWeight + batteryWeight + 1.2).toFixed(1));
  }, [cart, project.electrical.batteryId]);

  const moneyRemaining = totalAvailableFunding - cartTotalCost;
  const isOverBudget = moneyRemaining < 0;
  const isOverweight = cartEstimatedWeight > 30.0;

  // Filter products
  const filteredItems = useMemo(() => {
    return BOTBAY_ITEMS.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.tagline.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.engineeringNotes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const handleSelectCondition = (itemId: string, condition: PartCondition) => {
    soundEngine.playClick();
    setConditionSelections((prev) => ({ ...prev, [itemId]: condition }));

    // If item already in cart, update its condition
    const targetItem = BOTBAY_ITEMS.find((i) => i.id === itemId);
    if (targetItem && cart[targetItem.category]?.item.id === itemId) {
      setCart((prev) => ({
        ...prev,
        [targetItem.category]: { item: targetItem, condition },
      }));
    }
  };

  const handleAddToCart = (item: MarketplaceItem) => {
    soundEngine.playInstall();
    const cond = conditionSelections[item.id] || 'new';
    setCart((prev) => ({
      ...prev,
      [item.category]: { item, condition: cond },
    }));
  };

  const handleRemoveFromCart = (category: string) => {
    soundEngine.playClick();
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[category];
      return copy;
    });
  };

  const handleOpenCompare = (item: MarketplaceItem) => {
    soundEngine.playClick();
    const sameCategoryItems = BOTBAY_ITEMS.filter((i) => i.category === item.category && i.id !== item.id);
    const alternative = sameCategoryItems[0] || null;
    setCompareItems([item, alternative]);
    setShowCompareModal(true);
  };

  const requiredFulfilledCount = REQUIRED_MECHANICAL_CATEGORIES.filter((rc) => Boolean(cart[rc.id])).length;
  const isCartReadyToOrder = requiredFulfilledCount === REQUIRED_MECHANICAL_CATEGORIES.length && !isOverBudget;

  const handleFinalizeOrder = () => {
    if (!isCartReadyToOrder) return;
    soundEngine.playArenaHorn();

    const orderedParts: PurchasedMechanicalPart[] = Object.entries(cart).map(([cat, entry]) => ({
      category: cat as ComponentCategory,
      partId: entry.item.partId,
      condition: entry.condition,
      costUsd: entry.item.conditions[entry.condition].priceUsd,
      weightLb: entry.item.weightLb,
      name: entry.item.title,
    }));

    onOrderParts(orderedParts);
  };

  const getCategoryIcon = (cat: ComponentCategory) => {
    switch (cat) {
      case 'chassis':
        return <Box className="w-3.5 h-3.5" />;
      case 'drive':
        return <CircleDot className="w-3.5 h-3.5" />;
      case 'wheels':
        return <CircleDot className="w-3.5 h-3.5" />;
      case 'armor':
        return <Shield className="w-3.5 h-3.5" />;
      case 'weapon':
        return <Swords className="w-3.5 h-3.5" />;
      case 'utility':
        return <Wrench className="w-3.5 h-3.5" />;
      default:
        return <Box className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-5 overflow-hidden min-h-0 text-slate-800 font-sans">
      {/* Left / Center: Marketplace Storefront */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {/* Marketplace Banner & Live Team Budget Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 font-bold text-[10px] border border-cyan-200">
                  BOTBAY SURPLUS
                </span>
                <span className="text-[11px] text-slate-500">Official Component Exchange</span>
              </div>
              <h2 className="font-display font-black text-xl tracking-tight text-slate-900 mt-0.5">
                Marketplace Parts Catalog
              </h2>
            </div>

            {/* Shared Team Budget Box */}
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs shadow-xs">
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">SPONSOR FUND:</span>
                <span className="font-bold text-slate-700">
                  ${baseBudgetUsd} {sponsorshipUsd > 0 && <span className="text-emerald-600 font-extrabold">+${sponsorshipUsd} ({sponsorTier})</span>}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">TOTAL:</span>
                <span className="font-bold text-cyan-700 text-sm">${totalAvailableFunding}</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">REMAINING:</span>
                <span className={`font-bold text-sm ${isOverBudget ? 'text-rose-600 font-black animate-pulse' : 'text-emerald-600'}`}>
                  ${moneyRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* Search & Categories Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search components by name, power, mass, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All
              </button>
              {(['chassis', 'drive', 'wheels', 'armor', 'weapon', 'utility'] as ComponentCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span className="capitalize">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 bg-slate-50/50">
          {filteredItems.map((item) => {
            const currentCond = conditionSelections[item.id] || 'new';
            const condOption: ItemConditionOption = item.conditions[currentCond];
            const isInCart = cart[item.category]?.item.id === item.id;
            const cartCondition = cart[item.category]?.condition;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isInCart
                    ? 'bg-cyan-50/70 border-cyan-400 shadow-xs ring-1 ring-cyan-400/40'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div>
                  {/* 1. Large Part Visual (30-40% of card) */}
                  <div className="w-full h-32 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/80 grid place-items-center relative overflow-hidden mb-2.5">
                    {/* Subtle blueprint grid watermark */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                        backgroundSize: '12px 12px',
                      }}
                    />
                    <PartArt category={item.category} partId={item.partId} className="w-24 h-24 relative z-10" />
                  </div>

                  {/* 2. Title & Weight Badge */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-display font-black text-sm text-slate-900 leading-tight truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                      ⚖ {item.weightLb} lb
                    </span>
                  </div>

                  {/* 3. Exactly TWO short engineering traits */}
                  <div className="space-y-1 mb-2.5 text-[11px] font-sans">
                    <div className="flex items-start gap-1.5 text-emerald-700 font-medium leading-snug">
                      <span className="font-bold shrink-0">✓</span>
                      <span className="truncate">{item.pros[0]}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-slate-600 font-medium leading-snug">
                      <span className="font-bold shrink-0 text-amber-600">↓</span>
                      <span className="truncate">{item.tradeoffs[0]}</span>
                    </div>
                  </div>

                  {/* 4. Compact Condition Selector Pills */}
                  <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                    {(['new', 'refurbished', 'used'] as PartCondition[]).map((cond) => {
                      const opt = item.conditions[cond];
                      const isSelected = currentCond === cond;

                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => handleSelectCondition(item.id, cond)}
                          className={`cursor-pointer px-2 py-1.5 rounded-lg border text-center transition-all ${
                            isSelected
                              ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold ring-1 ring-cyan-500/20 shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[9px] uppercase tracking-wider block text-slate-400 font-bold">
                            {cond === 'refurbished' ? 'Refurb' : cond}
                          </span>
                          <span className="text-xs font-mono font-bold">${opt.priceUsd}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* One short consequence line revealed when selected */}
                  <div className="text-[10px] text-slate-500 leading-tight mb-2 truncate">
                    <span className="font-bold text-slate-700 capitalize">{currentCond}: </span>
                    <span>{condOption.note}</span>
                  </div>
                </div>

                {/* 5. Footer: Details & Add to Build */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setDetailItem(item);
                      }}
                      className="cursor-pointer text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      title="View full specs & seller details"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCompare(item)}
                      className="cursor-pointer text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                      title="Compare with another part"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className={`cursor-pointer flex-1 py-1.5 px-3 rounded-xl font-display font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition-all ${
                      isInCart
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    }`}
                  >
                    {isInCart ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>In Build{cartCondition ? ` (${cartCondition})` : ''}</span>
                      </>
                    ) : (
                      <span>Add to Build</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Build Cart & Checkout Drawer */}
      <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs text-xs font-sans">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <span className="font-display font-black text-sm text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-cyan-600" />
                Robot Assembly Cart
              </span>
              <span className="text-[10px] font-mono text-cyan-700 font-bold px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-200">
                {requiredFulfilledCount} / 5 Required
              </span>
            </div>

            {/* List of 5 Required Categories */}
            <div className="space-y-2 mb-4">
              {REQUIRED_MECHANICAL_CATEGORIES.map((reqCat) => {
                const entry = cart[reqCat.id];

                return (
                  <div
                    key={reqCat.id}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-colors ${
                      entry
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400 border-dashed'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">
                        {reqCat.id}:
                      </span>
                      {entry ? (
                        <span className="font-semibold truncate text-[11px] text-slate-900">
                          {entry.item.title}
                        </span>
                      ) : (
                        <span className="italic text-[10px] text-slate-400">Unselected</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry ? (
                        <>
                          <span className="font-mono font-bold text-slate-900">
                            ${entry.item.conditions[entry.condition].priceUsd}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(reqCat.id)}
                            className="cursor-pointer text-slate-400 hover:text-rose-600 p-0.5"
                            title="Remove from build"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-600 font-bold">REQUIRED</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Optional Utility */}
              {cart.utility && (
                <div className="p-2 rounded-xl border bg-slate-50 border-slate-200 text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">
                      UTILITY:
                    </span>
                    <span className="font-semibold truncate text-[11px] text-slate-900">
                      {cart.utility.item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-900">
                      ${cart.utility.item.conditions[cart.utility.condition].priceUsd}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart('utility')}
                      className="cursor-pointer text-slate-400 hover:text-rose-600 p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Total & Weight Estimator */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mb-4 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-sans">Total Spent:</span>
                <strong className="text-slate-900 text-sm font-bold">${cartTotalCost}</strong>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-sans">Money Remaining:</span>
                <strong className={isOverBudget ? 'text-rose-600 font-black animate-pulse' : 'text-emerald-700 font-bold'}>
                  ${moneyRemaining}
                </strong>
              </div>

              <div className="w-full h-px bg-slate-200 my-1" />

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-sans flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" />
                  Estimated Mass:
                </span>
                <strong className={isOverweight ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                  {cartEstimatedWeight} / 30.0 lb
                </strong>
              </div>
            </div>

            {/* Over-Budget / Overweight Warning Badges */}
            {isOverBudget && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="block text-rose-800 font-bold">INSUFFICIENT FUNDS</strong>
                  Need ${Math.abs(moneyRemaining)} more. Ask your <strong>Business Lead</strong> student to negotiate higher sponsorship!
                </div>
              </div>
            )}

            {isOverweight && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block text-amber-900 font-bold">MASS BUDGET WARNING</strong>
                  Build estimated at {cartEstimatedWeight} lb exceeds 30.0 lb limit. Consider lighter armor, chassis, or used parts!
                </div>
              </div>
            )}
          </div>

          {/* Checkout Order Button */}
          <button
            type="button"
            onClick={handleFinalizeOrder}
            disabled={!isCartReadyToOrder}
            className={`w-full py-3 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isCartReadyToOrder
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Order Robot Parts</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {project.mechanical.partsDelivered && onGoToWorkbench && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onGoToWorkbench();
              }}
              className="mt-2 w-full py-2.5 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
            >
              <span>Assembly Workbench →</span>
            </button>
          )}
        </div>
      </div>

      {/* Technical Flyer Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wider block mb-1">
              Technical Flyer • {detailItem.category.toUpperCase()}
            </span>
            <h3 className="font-display font-black text-2xl mb-1 text-slate-900">
              {detailItem.title}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{detailItem.tagline}</p>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 font-mono text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">MASS:</span>
                <strong className="text-slate-900">{detailItem.weightLb} lb</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">SUPPLIER:</span>
                <span className="text-slate-700 font-sans">{detailItem.seller}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">BASE PRICE:</span>
                <strong className="text-cyan-700">${detailItem.baseCostUsd}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">RATING:</span>
                <span className="text-amber-600 font-bold">★ {detailItem.rating} / 5.0</span>
              </div>
            </div>

            {/* Engineering Notes */}
            <div className="p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-200 mb-4">
              <span className="font-bold text-cyan-900 text-xs block mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-700" />
                Engineering Notes
              </span>
              <p className="text-xs text-cyan-950 leading-relaxed italic">
                "{detailItem.engineeringNotes}"
              </p>
            </div>

            {/* Pros & Tradeoffs */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="font-bold text-emerald-800 text-[11px] block mb-1.5 uppercase">
                  Advantages
                </span>
                <ul className="space-y-1 text-emerald-900 text-[11px]">
                  {detailItem.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="font-bold text-amber-800 text-[11px] block mb-1.5 uppercase">
                  Tradeoffs
                </span>
                <ul className="space-y-1 text-amber-900 text-[11px]">
                  {detailItem.tradeoffs.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-600">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Add to Build Action */}
            <button
              type="button"
              onClick={() => {
                handleAddToCart(detailItem);
                setDetailItem(null);
              }}
              className="cursor-pointer w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-display font-black text-xs uppercase transition-all shadow-xs"
            >
              Add to Build • ${detailItem.conditions[conditionSelections[detailItem.id] || 'new'].priceUsd}
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {showCompareModal && compareItems[0] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-slate-800 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowCompareModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wider block mb-1">
              Engineering Specification Tradeoffs
            </span>
            <h3 className="font-display font-black text-xl mb-4 text-slate-900">
              Side-by-Side Component Analysis
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {[0, 1].map((idx) => {
                const item = compareItems[idx];
                if (!item) return <div key={idx} className="p-4 bg-slate-50 rounded-2xl">No comparison item</div>;

                return (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-cyan-700 uppercase font-bold block mb-1">
                        Option {idx + 1}
                      </span>
                      <h4 className="font-display font-bold text-base text-slate-900 mb-1">
                        {item.title}
                      </h4>
                      <div className="text-sm font-mono font-bold text-cyan-700 mb-3">
                        ${item.baseCostUsd} (Base)
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 mb-3 font-mono">
                        <div className="flex justify-between py-1 border-b border-slate-200 font-sans">
                          <span className="text-slate-400">Mass:</span>
                          <strong className="text-slate-900 font-mono">{item.weightLb} lb</strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 font-sans">
                          <span className="text-slate-400">Rating:</span>
                          <span className="text-amber-600 font-mono">★ {item.rating}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 font-sans">
                          <span className="text-slate-400">Seller:</span>
                          <span className="text-slate-700">{item.seller}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 italic mb-3 font-sans">
                        "{item.engineeringNotes}"
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddToCart(item);
                        setShowCompareModal(false);
                      }}
                      className="cursor-pointer w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase"
                    >
                      Select This Option
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
