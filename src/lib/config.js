// ============================================
// CONFIG API - FILE MỚI
// Quản lý bảng app_config (bảng MỚI, không ảnh hưởng bảng cũ)
// ============================================
import { supabase } from './supabase'

// Lấy danh sách config theo module + type
export async function getConfigs(module, type = null) {
  let query = supabase.from('app_config').select('*')
    .eq('module', module).eq('is_active', true).order('sort_order')
  if (type) query = query.eq('type', type)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Thêm config
export async function createConfig(config) {
  const { data, error } = await supabase
    .from('app_config').insert([config]).select().single()
  if (error) throw error
  return data
}

// Cập nhật config
export async function updateConfig(id, updates) {
  const { error } = await supabase
    .from('app_config').update(updates).eq('id', id)
  if (error) throw error
}

// Xóa mềm config
export async function deleteConfig(id) {
  const { error } = await supabase
    .from('app_config').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// Lấy active modules từ settings (bảng settings CŨ, chỉ ĐỌC thêm 1 key mới)
export async function getActiveModules() {
  try {
    const { data } = await supabase
      .from('settings').select('value').eq('key', 'active_modules').single()
    return JSON.parse(data?.value || '["orders","expenses","lab","invest"]')
  } catch {
    return ['orders', 'expenses', 'lab', 'invest']
  }
}

// Lưu active modules
export async function setActiveModules(modules) {
  const { error } = await supabase
    .from('settings').upsert({ key: 'active_modules', value: JSON.stringify(modules) })
  if (error) throw error
}
