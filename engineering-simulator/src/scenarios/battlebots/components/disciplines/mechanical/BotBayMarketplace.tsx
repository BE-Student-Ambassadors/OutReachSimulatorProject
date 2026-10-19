import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Box,
  CircleDot,
  Shield,
  Swords,
  Wrench,
  Star,
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

interface BotBayMarketplaceProps {
  project: TeamRobotProject;
  currentPurchases: Record<string, PurchasedMechanicalPart>;
  onOrderParts: (parts: PurchasedMechanicalPart[]) => void;
}

export const BotBayMarketplace: React.FC<BotBayMarketplaceProps> = ({
  project,
  currentPurchases,
  onOrderParts,
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
    // Base weight from cart components + estimated 2.2 lb for internal wiring/radio/receiver
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
          item.seller.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const handleSelectCondition = (itemId: string, condition: PartCondition) => {
    soundEngine.playClick();
    setConditionSelections((prev) => ({ ...prev, [itemId]: condition }));
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
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const handleOpenCompare = (item: MarketplaceItem) => {
    soundEngine.playClick();
    // Find an alternative item in the same category
    const alternative = BOTBAY_ITEMS.find((i) => i.category === item.category && i.id !== item.id) || null;
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
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 overflow-hidden min-h-0 text-white font-mono-num">
      {/* Left / Center: Marketplace Storefront */}
      <div className="flex-1 flex flex-col bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Marketplace Banner & Live Team Budget Bar */}
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] border border-cyan-500/40">
                  OFFICIAL PARTS SURPLUS
                </span>
                <span className="text-[10px] text-slate-400">FICTIONAL ROBOTICS EXCHANGE</span>
              </div>
              <h2 className="font-display font-black text-2xl tracking-wide flex items-center gap-2 text-white">
                BOTBAY INDUSTRIAL SURPLUS
              </h2>
            </div>

            {/* Shared Team Budget Box */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-cyan-500/30 px-3.5 py-2 rounded-xl text-xs">
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">BASE + SPONSOR:</span>
                <span className="font-bold text-slate-200">
                  ${baseBudgetUsd} {sponsorshipUsd > 0 && <span className="text-emerald-400">+${sponsorshipUsd} ({sponsorTier})</span>}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">AVAILABLE FUNDING:</span>
                <span className="font-bold text-cyan-300 text-sm">${totalAvailableFunding}</span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase">MONEY LEFT:</span>
                <span className={`font-bold text-sm ${isOverBudget ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
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
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ALL
              </button>
              {(['chassis', 'drive', 'wheels', 'armor', 'weapon', 'utility'] as ComponentCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const currentCond = conditionSelections[item.id] || 'new';
            const condOption: ItemConditionOption = item.conditions[currentCond];
            const isInCart = cart[item.category]?.item.id === item.id;
            const cartCondition = cart[item.category]?.condition;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isInCart
                    ? 'bg-cyan-950/30 border-cyan-400 shadow-md shadow-cyan-950/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header: Seller, Rating, Category Badge */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(item.category)}
                      <strong className="text-slate-300 uppercase">{item.category}</strong> • {item.seller}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {item.rating} ({item.reviewCount})
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="font-display font-black text-base text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 mb-3 line-clamp-2">
                    {item.tagline}
                  </p>

                  {/* Condition Selector: NEW / REFURBISHED / USED */}
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                      SELECT CONDITION & PRICE:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['new', 'refurbished', 'used'] as PartCondition[]).map((cond) => {
                        const opt = item.conditions[cond];
                        const isSelected = currentCond === cond;

                        return (
                          <button
                            key={cond}
                            onClick={() => handleSelectCondition(item.id, cond)}
                            className={`cursor-pointer p-1.5 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-white'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-[10px] font-bold block uppercase">{cond}</span>
                            <span className="text-xs font-bold text-cyan-300">${opt.priceUsd}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Condition Clue Note */}
                    <div className="mt-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-300">
                      <span className="text-cyan-400 font-bold uppercase">{currentCond}: </span>
                      {condOption.note} • <span className="text-amber-300">{condOption.risk}</span>
                    </div>
                  </div>

                  {/* Key Engineering Specs Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.keySpecs.map((spec, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 rounded-md border ${
                          spec.highlight
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-bold'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        {spec.label}: <strong>{spec.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Controls: Flyer Preview, Compare, Add / In Cart */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setDetailItem(item);
                      }}
                      className="cursor-pointer text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="View rich technical flyer"
                    >
                      FLYER
                    </button>
                    <button
                      onClick={() => handleOpenCompare(item)}
                      className="cursor-pointer text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                      title="Compare with alternative"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      COMPARE
                    </button>
                  </div>

                  <button
                    onClick={() => handleAddToCart(item)}
                    className={`cursor-pointer px-4 py-1.5 rounded-xl font-display font-bold text-xs uppercase flex items-center gap-1.5 transition-all ${
                      isInCart
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                    }`}
                  >
                    {isInCart ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>IN BUILD ({cartCondition})</span>
                      </>
                    ) : (
                      <>
                        <span>ADD TO BUILD • ${condOption.priceUsd}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Build Cart & Checkout Drawer */}
      <div className="w-full lg:w-80 flex flex-col gap-3">
        {/* Your Build Summary Card */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl text-xs font-mono-num">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-cyan-400" />
                YOUR BUILD
              </span>
              <span className="text-[10px] text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40">
                {requiredFulfilledCount} / 5 REQUIRED
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
                        ? 'bg-slate-900/80 border-slate-700/80 text-white'
                        : 'bg-slate-950/50 border-slate-800/60 text-slate-500 border-dashed'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">
                        {reqCat.id}:
                      </span>
                      {entry ? (
                        <span className="font-bold truncate text-[11px] text-cyan-200">
                          {entry.item.title}
                        </span>
                      ) : (
                        <span className="italic text-[10px] text-slate-500">Unselected</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry ? (
                        <>
                          <span className="font-bold text-slate-200">
                            ${entry.item.conditions[entry.condition].priceUsd}
                          </span>
                          <button
                            onClick={() => handleRemoveFromCart(reqCat.id)}
                            className="cursor-pointer text-slate-500 hover:text-rose-400 p-0.5"
                            title="Remove from build"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-amber-400/80 font-bold">REQUIRED</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Optional Utility */}
              {cart.utility && (
                <div className="p-2 rounded-xl border bg-slate-900/80 border-slate-700/80 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">
                      UTILITY:
                    </span>
                    <span className="font-bold truncate text-[11px] text-cyan-200">
                      {cart.utility.item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-200">
                      ${cart.utility.item.conditions[cart.utility.condition].priceUsd}
                    </span>
                    <button
                      onClick={() => handleRemoveFromCart('utility')}
                      className="cursor-pointer text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Total & Weight Estimator */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">TOTAL SPENT:</span>
                <strong className="text-white text-sm">${cartTotalCost}</strong>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">TEAM MONEY LEFT:</span>
                <strong className={isOverBudget ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}>
                  ${moneyRemaining}
                </strong>
              </div>

              <div className="w-full h-px bg-slate-800 my-1" />

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" />
                  WEIGHT ESTIMATE:
                </span>
                <strong className={isOverweight ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {cartEstimatedWeight} / 30.0 LB
                </strong>
              </div>
            </div>

            {/* Over-Budget / Overweight Warning Badges */}
            {isOverBudget && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[11px] text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="block text-rose-200 font-bold">INSUFFICIENT FUNDS</strong>
                  Need ${Math.abs(moneyRemaining)} more. Ask your <strong>Business / Project Lead</strong> student to upgrade team sponsorship!
                </div>
              </div>
            )}

            {isOverweight && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="block text-amber-200 font-bold">MASS BUDGET WARNING</strong>
                  Build estimated at {cartEstimatedWeight} lb exceeds 30.0 lb limit. Consider lighter armor, chassis, or used parts!
                </div>
              </div>
            )}
          </div>

          {/* Checkout Order Button */}
          <button
            onClick={handleFinalizeOrder}
            disabled={!isCartReadyToOrder}
            className={`w-full py-3 rounded-xl font-display font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
              isCartReadyToOrder
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 cursor-pointer transform hover:-translate-y-0.5 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
            }`}
          >
            <span>ORDER PARTS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Technical Flyer Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl text-white font-mono-num max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailItem(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
              TECHNICAL FLYER SPEC SHEET • {detailItem.category.toUpperCase()}
            </span>
            <h3 className="font-display font-black text-2xl mb-2 text-white">
              {detailItem.title}
            </h3>
            <p className="text-xs text-slate-300 mb-4">{detailItem.tagline}</p>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">MASS:</span>
                <strong className="text-white">{detailItem.weightLb} lb</strong>
              </div>
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">SUPPLIER:</span>
                <span className="text-slate-200">{detailItem.seller}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">BASE PRICE:</span>
                <strong className="text-cyan-300">${detailItem.baseCostUsd}</strong>
              </div>
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">RATING:</span>
                <span className="text-amber-400 font-bold">★ {detailItem.rating} / 5.0</span>
              </div>
            </div>

            {/* Engineering Notes */}
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 mb-4">
              <span className="font-bold text-cyan-300 text-xs block mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                ENGINEERING NOTES
              </span>
              <p className="text-xs text-slate-200 leading-relaxed italic">
                "{detailItem.engineeringNotes}"
              </p>
            </div>

            {/* Pros & Tradeoffs */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <span className="font-bold text-emerald-400 text-[11px] block mb-1.5 uppercase">
                  ADVANTAGES
                </span>
                <ul className="space-y-1 text-slate-300 text-[11px]">
                  {detailItem.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400">✓</span> {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                <span className="font-bold text-amber-400 text-[11px] block mb-1.5 uppercase">
                  TRADEOFFS
                </span>
                <ul className="space-y-1 text-slate-300 text-[11px]">
                  {detailItem.tradeoffs.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Add to Build Action */}
            <button
              onClick={() => {
                handleAddToCart(detailItem);
                setDetailItem(null);
              }}
              className="cursor-pointer w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-black text-xs uppercase transition-all shadow-md"
            >
              ADD TO BUILD • ${detailItem.conditions[conditionSelections[detailItem.id] || 'new'].priceUsd}
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {showCompareModal && compareItems[0] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl text-white font-mono-num max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setShowCompareModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
              ENGINEERING SPECIFICATION TRADEOFF COMPARISON
            </span>
            <h3 className="font-display font-black text-xl mb-4">
              SIDE-BY-SIDE COMPONENT ANALYSIS
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {[0, 1].map((idx) => {
                const item = compareItems[idx];
                if (!item) return <div key={idx} className="p-4 bg-slate-900 rounded-xl">No comparison item</div>;

                return (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-cyan-400 uppercase font-bold block mb-1">
                        OPTION {idx + 1}
                      </span>
                      <h4 className="font-display font-bold text-base text-white mb-1">
                        {item.title}
                      </h4>
                      <div className="text-sm font-bold text-cyan-300 mb-3">
                        ${item.baseCostUsd} (Base)
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 mb-3">
                        <div className="flex justify-between py-1 border-b border-slate-800">
                          <span className="text-slate-400">Mass:</span>
                          <strong className="text-white">{item.weightLb} lb</strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800">
                          <span className="text-slate-400">Rating:</span>
                          <span className="text-amber-400">★ {item.rating}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800">
                          <span className="text-slate-400">Seller:</span>
                          <span className="text-slate-300">{item.seller}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 italic mb-3">
                        "{item.engineeringNotes}"
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        handleAddToCart(item);
                        setShowCompareModal(false);
                      }}
                      className="cursor-pointer w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase"
                    >
                      SELECT THIS OPTION
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
