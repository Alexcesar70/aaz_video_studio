'use client'

import React, { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#13131a', surface: '#1a1a24', card: '#22222e', border: '#2e2e3e',
  borderHi: '#3a3a4e', gold: '#C9A84C', blue: '#5B8DEF', green: '#4ADE80',
  red: '#F87171', purple: '#A78BFA', text: '#E8E8F0', textDim: '#9898B0',
}

type View = 'dashboard' | 'orgs' | 'plans' | 'users' | 'financial'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${color}40`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function DashboardView() {
  const [data, setData] = useState<D | null>(null)
  useEffect(() => { fetch('/api/admin/dashboard').then(r => r.json()).then(setData).catch(() => {}) }, [])
  if (!data) return <div style={{ color: C.textDim }}>Carregando dashboard...</div>
  const bal = data.segmindBalance
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Dashboard</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPI label="Organizações" value={`${data.activeOrgs ?? 0}`} sub={`${data.suspendedOrgs ?? 0} suspensas`} color={C.blue} />
        <KPI label="Usuários" value={`${data.activeUsers ?? 0}`} sub={`${data.totalUsers ?? 0} total`} color={C.purple} />
        <KPI label="Receita total" value={`$${(data.totalRevenue ?? 0).toFixed(2)}`} sub="top-ups acumulados" color={C.green} />
        <KPI label="Saldo Segmind" value={bal != null ? `$${bal.toFixed(2)}` : '—'} sub={bal != null && bal < 10 ? 'SALDO BAIXO' : 'conta ativa'} color={bal != null && bal < 10 ? C.red : C.blue} />
      </div>
      {data.topOrgs?.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Top organizações por gasto</div>
          {data.topOrgs.map((o: D) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}80`, fontSize: 13 }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{o.name}</span>
              <span style={{ color: C.green, fontFamily: 'monospace' }}>${(o.spend ?? 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function OrgsView() {
  const [orgs, setOrgs] = useState<D[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<D | null>(null)
  const [creditAmt, setCreditAmt] = useState('')
  const [creditDesc, setCreditDesc] = useState('')
  const [msg, setMsg] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [plans, setPlans] = useState<D[]>([])
  const [newOrg, setNewOrg] = useState({ name: '', type: 'team', plan: '', billingEmail: '', maxUsers: '5', leaderCanCreate: true })

  const load = useCallback(() => {
    fetch('/api/admin/organizations').then(r => r.json()).then(d => setOrgs(d.organizations ?? [])).catch(() => {})
    fetch('/api/admin/plans').then(r => r.json()).then(d => setPlans(d.plans ?? [])).catch(() => {})
  }, [])
  useEffect(load, [load])

  const createOrg = async () => {
    if (!newOrg.name.trim()) return
    const r = await fetch('/api/admin/organizations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newOrg, maxUsers: parseInt(newOrg.maxUsers) || 5, products: ['aaz_studio'] })
    })
    if (r.ok) { setShowCreate(false); setNewOrg({ name: '', type: 'team', plan: '', billingEmail: '', maxUsers: '5', leaderCanCreate: true }); load(); setMsg('Organização criada!') }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'Erro ao criar') }
  }

  const loadDetail = useCallback((id: string) => {
    setSelected(id); setDetail(null); setMsg('')
    fetch(`/api/admin/organizations/${id}`).then(r => r.json()).then(setDetail).catch(() => {})
  }, [])

  const addCredits = async () => {
    if (!selected || !creditAmt) return
    const r = await fetch(`/api/admin/organizations/${selected}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_credits', amount: parseFloat(creditAmt), description: creditDesc || 'Recarga manual' }) })
    if (r.ok) { setMsg('Créditos adicionados!'); setCreditAmt(''); setCreditDesc(''); loadDetail(selected) } else { setMsg('Erro ao adicionar') }
  }

  const toggleStatus = async (action: string) => {
    if (!selected) return
    await fetch(`/api/admin/organizations/${selected}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    loadDetail(selected); load()
  }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const btnStyle = { background: C.gold, border: 'none', borderRadius: 6, padding: '8px 14px', color: '#000', fontSize: 12, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Organizações</div>
        <button onClick={() => setShowCreate(!showCreate)} style={btnStyle}>{showCreate ? 'Cancelar' : '+ Nova Organização'}</button>
      </div>

      {showCreate && (
        <div style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Nova Organização</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>NOME</div>
              <input placeholder="Nome da organização" value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>EMAIL DE BILLING</div>
              <input placeholder="email@empresa.com" value={newOrg.billingEmail} onChange={e => setNewOrg({ ...newOrg, billingEmail: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>TIPO</div>
              <select value={newOrg.type} onChange={e => setNewOrg({ ...newOrg, type: e.target.value })} style={inputStyle}>
                <option value="individual">Individual</option>
                <option value="team">Time</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>PLANO</div>
              <select value={newOrg.plan} onChange={e => setNewOrg({ ...newOrg, plan: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                {plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>MAX USUÁRIOS</div>
              <input type="number" value={newOrg.maxUsers} onChange={e => setNewOrg({ ...newOrg, maxUsers: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>LÍDER CRIA CONTEÚDO?</div>
              <select value={newOrg.leaderCanCreate ? 'sim' : 'nao'} onChange={e => setNewOrg({ ...newOrg, leaderCanCreate: e.target.value === 'sim' })} style={inputStyle}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
          <button onClick={createOrg} style={{ ...btnStyle, alignSelf: 'flex-start', marginTop: 4 }}>Criar organização</button>
          {msg && <div style={{ fontSize: 12, color: msg.includes('Erro') ? C.red : C.green }}>{msg}</div>}
        </div>
      )}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
          <div>NOME</div><div>PLANO</div><div>TIPO</div><div>MEMBROS</div><div>SALDO</div><div>STATUS</div>
        </div>
        {orgs.map(o => (
          <div key={o.id} onClick={() => loadDetail(o.id)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 12, borderBottom: `1px solid ${C.border}80`, cursor: 'pointer', background: selected === o.id ? C.card : 'transparent' }}>
            <div style={{ color: C.blue, fontWeight: 600 }}>{o.name}</div>
            <div style={{ color: C.textDim }}>{o.planName ?? o.plan}</div>
            <div style={{ color: C.textDim }}>{o.type === 'team' ? 'Time' : 'Individual'}</div>
            <div style={{ color: C.textDim }}>{o.memberCount ?? 0}</div>
            <div style={{ color: C.green, fontFamily: 'monospace' }}>${(o.walletBalance ?? 0).toFixed(2)}</div>
            <div><span style={{ fontSize: 10, fontWeight: 700, color: o.status === 'active' ? C.green : C.red, background: o.status === 'active' ? `${C.green}20` : `${C.red}20`, padding: '2px 8px', borderRadius: 4 }}>{o.status === 'active' ? 'Ativo' : 'Suspenso'}</span></div>
          </div>
        ))}
        {orgs.length === 0 && <div style={{ color: C.textDim, padding: 20, textAlign: 'center', fontSize: 12 }}>Nenhuma organização cadastrada.</div>}
      </div>

      {detail && (
        <div style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{detail.org?.name}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{detail.org?.slug} · {detail.org?.type === 'team' ? 'Time' : 'Individual'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {detail.org?.status === 'active'
                ? <button onClick={() => toggleStatus('suspend')} style={{ ...btnStyle, background: C.red, color: '#fff' }}>Suspender</button>
                : <button onClick={() => toggleStatus('reactivate')} style={btnStyle}>Reativar</button>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <KPI label="Saldo" value={`$${(detail.wallet?.balanceUsd ?? 0).toFixed(2)}`} color={C.green} />
            <KPI label="Total recebido" value={`$${(detail.wallet?.totalTopUps ?? 0).toFixed(2)}`} color={C.blue} />
            <KPI label="Total gasto" value={`$${(detail.wallet?.totalSpent ?? 0).toFixed(2)}`} color={C.purple} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Adicionar créditos</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input type="number" placeholder="Valor (USD)" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            <input placeholder="Descrição (opcional)" value={creditDesc} onChange={e => setCreditDesc(e.target.value)} style={inputStyle} />
            <button onClick={addCredits} style={btnStyle}>Adicionar</button>
          </div>
          {msg && <div style={{ fontSize: 12, color: C.green, marginBottom: 10 }}>{msg}</div>}
          {detail.members?.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Membros ({detail.members.length})</div>
              {detail.members.map((m: D) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}80`, fontSize: 12 }}>
                  <span style={{ color: C.text }}>{m.name} <span style={{ color: C.textDim }}>({m.email})</span></span>
                  <span style={{ color: m.role === 'admin' ? C.gold : C.textDim }}>{m.role}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
function PlansView() {
  const [plans, setPlans] = useState<D[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', priceMonthlyUsd: '', creditsMonthlyUsd: '', maxUsers: '1', type: 'both' })

  const load = useCallback(() => { fetch('/api/admin/plans').then(r => r.json()).then(d => setPlans(d.plans ?? [])).catch(() => {}) }, [])
  useEffect(load, [load])

  const create = async () => {
    const r = await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, priceMonthlyUsd: parseFloat(form.priceMonthlyUsd) || 0, creditsMonthlyUsd: parseFloat(form.creditsMonthlyUsd) || 0, maxUsers: parseInt(form.maxUsers) || 1, engines: [], products: ['aaz_studio'], isActive: true }) })
    if (r.ok) { setShowForm(false); setForm({ name: '', priceMonthlyUsd: '', creditsMonthlyUsd: '', maxUsers: '1', type: 'both' }); load() }
  }

  const toggle = async (id: string, active: boolean) => {
    if (active) { await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' }) }
    else { await fetch(`/api/admin/plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true }) }) }
    load()
  }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const btnStyle = { background: C.gold, border: 'none', borderRadius: 6, padding: '8px 14px', color: '#000', fontSize: 12, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Planos</div>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>{showForm ? 'Cancelar' : '+ Novo Plano'}</button>
      </div>
      {showForm && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Nome do plano" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <input placeholder="Preço/mês (USD)" value={form.priceMonthlyUsd} onChange={e => setForm({ ...form, priceMonthlyUsd: e.target.value })} style={inputStyle} />
            <input placeholder="Créditos/mês (USD)" value={form.creditsMonthlyUsd} onChange={e => setForm({ ...form, creditsMonthlyUsd: e.target.value })} style={inputStyle} />
            <input placeholder="Max usuários" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: e.target.value })} style={inputStyle} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}><option value="both">Ambos</option><option value="individual">Individual</option><option value="team">Time</option></select>
          </div>
          <button onClick={create} style={{ ...btnStyle, alignSelf: 'flex-start' }}>Criar plano</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {plans.map(p => (
          <div key={p.id} style={{ background: C.surface, border: `1px solid ${p.isActive ? C.border : C.red}40`, borderRadius: 12, padding: 18, opacity: p.isActive ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.name}</div>
              <span style={{ fontSize: 9, fontWeight: 700, color: p.isActive ? C.green : C.red, background: p.isActive ? `${C.green}20` : `${C.red}20`, padding: '2px 6px', borderRadius: 4 }}>{p.isActive ? 'ATIVO' : 'INATIVO'}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.gold, fontFamily: 'monospace', marginBottom: 8 }}>${p.priceMonthlyUsd}/mês</div>
            <div style={{ fontSize: 11, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Créditos: ${p.creditsMonthlyUsd}/mês</div>
              <div>Max users: {p.maxUsers}</div>
              <div>Tipo: {p.type === 'both' ? 'Ambos' : p.type === 'team' ? 'Time' : 'Individual'}</div>
            </div>
            <button onClick={() => toggle(p.id, p.isActive)} style={{ marginTop: 10, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px', color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{p.isActive ? 'Desativar' : 'Reativar'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
function UsersView() {
  const [users, setUsers] = useState<D[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<D | null>(null)
  const [newPw, setNewPw] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => { fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(() => {}) }, [])
  useEffect(load, [load])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  const resetPassword = async (id: string) => {
    const r = await fetch(`/api/admin/users/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_password' }) })
    if (r.ok) { const d = await r.json(); setNewPw(d.password) } else { setMsg('Erro ao resetar senha') }
  }

  const updateRole = async (id: string, role: string) => {
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    load(); if (selected?.id === id) setSelected({ ...selected, role })
  }

  const toggleStatus = async (id: string, current: string) => {
    const status = current === 'active' ? 'revoked' : 'active'
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load(); if (selected?.id === id) setSelected({ ...selected, status })
  }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Usuários</div>
      <input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '100%', maxWidth: 400 }} />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
          <div>NOME</div><div>EMAIL</div><div>ORG</div><div>ROLE</div><div>STATUS</div><div>AÇÕES</div>
        </div>
        {filtered.slice(0, 50).map(u => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1fr', gap: 8, padding: '10px 16px', fontSize: 12, borderBottom: `1px solid ${C.border}80`, alignItems: 'center' }}>
            <div style={{ color: C.text, fontWeight: 600 }}>{u.name}</div>
            <div style={{ color: C.textDim }}>{u.email}</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>{u.orgName ?? '—'}</div>
            <div><span style={{ fontSize: 10, fontWeight: 700, color: u.role === 'super_admin' ? C.gold : u.role === 'admin' ? C.purple : C.textDim }}>{u.role}</span></div>
            <div><span style={{ fontSize: 10, fontWeight: 700, color: u.status === 'active' ? C.green : C.red }}>{u.status === 'active' ? 'Ativo' : 'Revogado'}</span></div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setSelected(u); setNewPw(null); setMsg('') }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.textDim, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Detalhes</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div onClick={() => { setSelected(null); setNewPw(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>{selected.email} · {selected.orgName ?? 'sem org'}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.textDim }}>Role:</span>
              <select value={selected.role} onChange={e => updateRole(selected.id, e.target.value)} style={inputStyle}>
                <option value="creator">creator</option><option value="admin">admin</option><option value="super_admin">super_admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => toggleStatus(selected.id, selected.status)} style={{ background: selected.status === 'active' ? C.red : C.green, border: 'none', borderRadius: 6, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{selected.status === 'active' ? 'Revogar acesso' : 'Reativar'}</button>
              <button onClick={() => resetPassword(selected.id)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 14px', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Resetar senha</button>
            </div>
            {newPw && (
              <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>NOVA SENHA (copie agora — não será exibida novamente)</div>
                <div style={{ fontSize: 16, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{newPw}</div>
              </div>
            )}
            {msg && <div style={{ fontSize: 12, color: C.red }}>{msg}</div>}
            <button onClick={() => { setSelected(null); setNewPw(null) }} style={{ marginTop: 8, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', color: C.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
function FinancialView() {
  const [orgs, setOrgs] = useState<D[]>([])
  const [orgId, setOrgId] = useState('')
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [txns, setTxns] = useState<D[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/admin/organizations').then(r => r.json()).then(d => { setOrgs(d.organizations ?? []); if (d.organizations?.length) setOrgId(d.organizations[0].id) }).catch(() => {}) }, [])

  const search = async () => {
    if (!orgId) return
    setLoading(true)
    try { const r = await fetch(`/api/admin/export?orgId=${orgId}&from=${from}&to=${to}&format=json`); const d = await r.json(); setTxns(d.transactions ?? []) } catch {} finally { setLoading(false) }
  }

  const exportCSV = () => { if (!orgId) return; window.open(`/api/admin/export?orgId=${orgId}&from=${from}&to=${to}&format=csv`, '_blank') }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }
  const btnStyle = { background: C.gold, border: 'none', borderRadius: 6, padding: '8px 14px', color: '#000', fontSize: 12, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }

  const typeLabels: Record<string, string> = { top_up: 'Recarga', spend: 'Gasto', transfer_in: 'Recebido', transfer_out: 'Transferido', refund: 'Estorno', adjustment: 'Ajuste', monthly_credit: 'Crédito mensal' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Financeiro</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={orgId} onChange={e => setOrgId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
        <button onClick={search} disabled={loading} style={btnStyle}>{loading ? 'Buscando...' : 'Buscar'}</button>
        <button onClick={exportCSV} style={{ ...btnStyle, background: C.card, color: C.text, border: `1px solid ${C.border}` }}>Exportar CSV</button>
      </div>
      {txns.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 2fr 100px 100px', gap: 8, padding: '10px 16px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
            <div>DATA</div><div>TIPO</div><div>DESCRIÇÃO</div><div style={{ textAlign: 'right' }}>VALOR</div><div style={{ textAlign: 'right' }}>SALDO</div>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {txns.map((t: D) => {
              const dt = new Date(t.createdAt)
              const isPositive = t.amountUsd > 0
              return (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 2fr 100px 100px', gap: 8, padding: '8px 16px', fontSize: 12, borderBottom: `1px solid ${C.border}80`, alignItems: 'center' }}>
                  <div style={{ color: C.textDim, fontFamily: 'monospace', fontSize: 11 }}>{dt.toLocaleDateString('pt-BR')} {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div><span style={{ fontSize: 10, fontWeight: 700, color: isPositive ? C.green : C.red }}>{typeLabels[t.type] ?? t.type}</span></div>
                  <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isPositive ? C.green : C.red }}>{isPositive ? '+' : ''}{t.amountUsd?.toFixed(2)}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', color: C.textDim }}>${t.balanceAfter?.toFixed(2)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {txns.length === 0 && orgId && <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>Selecione o período e clique em Buscar.</div>}
    </div>
  )
}

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'orgs', label: 'Organizações', icon: '🏢' },
  { id: 'plans', label: 'Planos', icon: '📋' },
  { id: 'users', label: 'Usuários', icon: '👥' },
  { id: 'financial', label: 'Financeiro', icon: '💰' },
]

export function SuperAdmin() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 20px', borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>AAZ Platform</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Super Admin</div>
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px',
            background: view === n.id ? C.card : 'transparent', border: 'none', borderLeft: view === n.id ? `3px solid ${C.gold}` : '3px solid transparent',
            cursor: 'pointer', color: view === n.id ? C.text : C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <div style={{ padding: '16px 20px', marginTop: 'auto', borderTop: `1px solid ${C.border}`, position: 'absolute', bottom: 0, width: 220 }}>
          <a href="/studio" style={{ color: C.blue, fontSize: 12, textDecoration: 'none' }}>← Voltar ao Studio</a>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 28, overflowY: 'auto', maxHeight: '100vh' }}>
        {view === 'dashboard' && <DashboardView />}
        {view === 'orgs' && <OrgsView />}
        {view === 'plans' && <PlansView />}
        {view === 'users' && <UsersView />}
        {view === 'financial' && <FinancialView />}
      </div>
    </div>
  )
}
