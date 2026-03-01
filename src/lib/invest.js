// ============================================
// INVEST API - AVERAGE COST METHOD
// Giá vốn bình quân (giống SSI, VPS, TCBS)
// Xóa/sửa bất kỳ GD → tính lại toàn bộ tự động
// ============================================
import { supabase } from './supabase'

// ============================================
// CỔ PHIẾU
// ============================================
export async function getStocks() {
  const { data, error } = await supabase
    .from('stocks').select(`
      *,
      transactions:stock_transactions(id, type, quantity, price, fee, date, note, created_at),
      dividends(id, amount, date, note)
    `)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createStock(stock) {
  const { data, error } = await supabase
    .from('stocks').insert([{
      symbol: stock.symbol.toUpperCase().trim(),
      name: stock.name || '',
      current_price: stock.current_price || 0,
      note: stock.note || ''
    }]).select().single()
  if (error) throw error
  return data
}

export async function updateStock(id, updates) {
  const { error } = await supabase
    .from('stocks').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteStock(id) {
  const { error } = await supabase
    .from('stocks').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ============================================
// GIAO DỊCH MUA/BÁN
// ============================================
export async function addStockTransaction(tx) {
  const { data, error } = await supabase
    .from('stock_transactions').insert([{
      stock_id: tx.stock_id,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      fee: tx.fee || 0,
      date: tx.date || new Date().toISOString().split('T')[0],
      note: tx.note || ''
    }]).select().single()
  if (error) throw error
  return data
}

export async function updateStockTransaction(id, updates) {
  const { error } = await supabase
    .from('stock_transactions').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteStockTransaction(id) {
  const { error } = await supabase
    .from('stock_transactions').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// CỔ TỨC
// ============================================
export async function addDividend(div) {
  const { data, error } = await supabase
    .from('dividends').insert([{
      stock_id: div.stock_id,
      amount: div.amount,
      date: div.date || new Date().toISOString().split('T')[0],
      note: div.note || ''
    }]).select().single()
  if (error) throw error
  return data
}

export async function deleteDividend(id) {
  const { error } = await supabase
    .from('dividends').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// TÍNH TOÁN - AVERAGE COST (GIÁ VỐN BÌNH QUÂN)
// Replay toàn bộ giao dịch theo thứ tự thời gian
// → Giá vốn TB thay đổi sau mỗi lệnh MUA
// → Lệnh BÁN tính lãi/lỗ theo giá vốn TB tại thời điểm bán
// ============================================
export function calcStockStats(stock) {
  const txs = (stock.transactions || [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || ''))
  const divs = stock.dividends || []

  let holdingQty = 0       // Số CP đang giữ
  let holdingCost = 0      // Tổng giá vốn đang giữ (= holdingQty × avgCost)
  let avgCost = 0          // Giá vốn bình quân hiện tại (gồm phí)
  let avgBuyPrice = 0      // Giá mua bình quân (không gồm phí, để hiển thị)

  let totalQtyBought = 0, totalCostBought = 0, totalFeeBuy = 0
  let totalQtySold = 0, totalRevenueSold = 0, totalFeeSell = 0
  let realizedPL = 0       // Tổng lãi/lỗ đã chốt

  // Chi tiết từng giao dịch (để hiển thị)
  const txDetails = []

  for (const tx of txs) {
    const qty = tx.quantity
    const price = Number(tx.price)
    const fee = Number(tx.fee) || 0

    if (tx.type === 'buy') {
      totalQtyBought += qty
      totalCostBought += qty * price
      totalFeeBuy += fee

      // Cập nhật giá vốn bình quân
      const newTotalCost = holdingCost + qty * price + fee
      holdingQty += qty
      holdingCost = newTotalCost
      avgCost = holdingQty > 0 ? holdingCost / holdingQty : 0

      // Giá mua TB (không gồm phí)
      avgBuyPrice = totalQtyBought > 0 ? totalCostBought / totalQtyBought : 0

      txDetails.push({
        ...tx, txType: 'buy',
        total: qty * price + fee,
        avgCostAfter: avgCost,
        holdingAfter: holdingQty,
        pl: null, plPct: null
      })

    } else if (tx.type === 'sell') {
      totalQtySold += qty
      totalRevenueSold += qty * price
      totalFeeSell += fee

      // Lãi/lỗ = (giá bán - giá vốn TB) × SL - phí bán
      const costBasis = qty * avgCost
      const revenue = qty * price
      const pl = revenue - costBasis - fee
      const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0
      realizedPL += pl

      // Cập nhật holding
      holdingQty -= qty
      holdingCost = holdingQty * avgCost // Giá vốn TB không đổi khi bán

      txDetails.push({
        ...tx, txType: 'sell',
        total: qty * price - fee,
        costBasis,
        pl, plPct,
        avgCostAtSell: avgCost,
        holdingAfter: holdingQty
      })
    }
  }

  // Giá trị hiện tại
  const currentPrice = Number(stock.current_price) || 0
  const marketValue = holdingQty * currentPrice
  const investedInHolding = holdingCost // = holdingQty × avgCost

  // Unrealized
  const unrealizedPL = marketValue - investedInHolding
  const unrealizedPLPct = investedInHolding > 0 ? (unrealizedPL / investedInHolding) * 100 : 0

  // Cổ tức
  const totalDividends = divs.reduce((sum, d) => sum + Number(d.amount), 0)

  // Tổng P&L
  const totalPL = unrealizedPL + realizedPL + totalDividends
  const totalInvested = totalCostBought + totalFeeBuy
  const totalFee = totalFeeBuy + totalFeeSell

  return {
    holdingQty, avgCost, avgBuyPrice, currentPrice, marketValue,
    investedInHolding, unrealizedPL, unrealizedPLPct,
    realizedPL, totalDividends, totalPL, totalInvested,
    totalQtyBought, totalQtySold, totalCostBought, totalRevenueSold,
    totalFee, totalFeeBuy, totalFeeSell,
    buyCount: txs.filter(t => t.type === 'buy').length,
    sellCount: txs.filter(t => t.type === 'sell').length,
    txDetails // Chi tiết theo thứ tự thời gian
  }
}

// ============================================
// PORTFOLIO
// ============================================
export function calcPortfolioStats(stocks) {
  let totalMarketValue = 0, totalInvested = 0
  let totalUnrealized = 0, totalRealized = 0, totalDividends = 0

  const details = stocks.map(s => {
    const stats = calcStockStats(s)
    totalMarketValue += stats.marketValue
    totalInvested += stats.investedInHolding
    totalUnrealized += stats.unrealizedPL
    totalRealized += stats.realizedPL
    totalDividends += stats.totalDividends
    return { ...s, stats }
  })

  const totalPL = totalUnrealized + totalRealized + totalDividends
  return {
    stocks: details, totalMarketValue, totalInvested,
    totalUnrealized, totalRealized, totalDividends, totalPL,
    totalPLPercent: totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0
  }
}

// Sync stock summary fields
export async function recalcStock(stockId, stock) {
  const stats = calcStockStats(stock)
  await updateStock(stockId, {
    current_qty: stats.holdingQty,
    avg_price: Math.round(stats.avgCost),
    total_invested: Math.round(stats.totalCostBought),
    total_realized: Math.round(stats.realizedPL)
  })
}
