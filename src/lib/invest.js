// ============================================
// INVEST API - FILE MỚI
// Tương tác: stocks, stock_transactions, dividends
// KHÔNG đụng bảng cũ
// ============================================
import { supabase } from './supabase'

// ============================================
// CỔ PHIẾU
// ============================================
export async function getStocks() {
  const { data, error } = await supabase
    .from('stocks').select(`
      *,
      transactions:stock_transactions(id, type, quantity, price, fee, date, note, lot_status, remaining_qty),
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
      note: tx.note || '',
      lot_status: tx.type === 'buy' ? 'open' : null,
      remaining_qty: tx.type === 'buy' ? tx.quantity : 0
    }]).select().single()
  if (error) throw error
  return data
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
// TÍNH TOÁN (client-side)
// ============================================

// Tính toán cho 1 cổ phiếu
export function calcStockStats(stock) {
  const buys = (stock.transactions || []).filter(t => t.type === 'buy')
  const sells = (stock.transactions || []).filter(t => t.type === 'sell')
  const divs = stock.dividends || []

  // Tổng mua
  let totalQtyBought = 0, totalCostBought = 0, totalFeeBuy = 0
  buys.forEach(b => {
    totalQtyBought += b.quantity
    totalCostBought += b.quantity * Number(b.price)
    totalFeeBuy += Number(b.fee) || 0
  })

  // Tổng bán
  let totalQtySold = 0, totalRevenueSold = 0, totalFeeSell = 0
  sells.forEach(s => {
    totalQtySold += s.quantity
    totalRevenueSold += s.quantity * Number(s.price)
    totalFeeSell += Number(s.fee) || 0
  })

  // Số lượng đang giữ
  const holdingQty = totalQtyBought - totalQtySold

  // Giá trung bình mua
  const avgBuyPrice = totalQtyBought > 0 ? totalCostBought / totalQtyBought : 0

  // Giá trị hiện tại
  const currentPrice = Number(stock.current_price) || 0
  const marketValue = holdingQty * currentPrice

  // Tổng vốn đã bỏ ra (cho phần đang giữ)
  const investedInHolding = holdingQty * avgBuyPrice

  // Lãi/lỗ chưa thực hiện (unrealized)
  const unrealizedPL = marketValue - investedInHolding
  const unrealizedPLPercent = investedInHolding > 0 ? (unrealizedPL / investedInHolding) * 100 : 0

  // Lãi/lỗ đã thực hiện (realized) = doanh thu bán - chi phí mua phần đã bán - phí
  const costOfSold = totalQtySold * avgBuyPrice
  const realizedPL = totalRevenueSold - costOfSold - totalFeeBuy - totalFeeSell

  // Cổ tức
  const totalDividends = divs.reduce((s, d) => s + Number(d.amount), 0)

  // Tổng lãi/lỗ
  const totalPL = unrealizedPL + realizedPL + totalDividends

  // Tổng vốn đã đầu tư
  const totalInvested = totalCostBought + totalFeeBuy

  return {
    holdingQty, avgBuyPrice, currentPrice, marketValue,
    investedInHolding, unrealizedPL, unrealizedPLPercent,
    realizedPL, totalDividends, totalPL, totalInvested,
    totalQtyBought, totalQtySold, totalCostBought, totalRevenueSold,
    totalFee: totalFeeBuy + totalFeeSell,
    buyCount: buys.length, sellCount: sells.length
  }
}

// Tính tổng portfolio
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

  return {
    stocks: details,
    totalMarketValue,
    totalInvested,
    totalUnrealized,
    totalRealized,
    totalDividends,
    totalPL: totalUnrealized + totalRealized + totalDividends,
    totalPLPercent: totalInvested > 0 ? ((totalUnrealized + totalRealized + totalDividends) / totalInvested) * 100 : 0
  }
}

// Recalc & sync stock fields
export async function recalcStock(stockId, stock) {
  const stats = calcStockStats(stock)
  await updateStock(stockId, {
    current_qty: stats.holdingQty,
    avg_price: Math.round(stats.avgBuyPrice),
    total_invested: Math.round(stats.totalCostBought),
    total_realized: Math.round(stats.realizedPL)
  })
}
