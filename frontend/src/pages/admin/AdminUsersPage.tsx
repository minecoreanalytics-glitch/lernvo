import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, Plus, X, Loader2, ChevronDown, Upload, Download, FileText, CheckCircle, AlertTriangle, Pencil, KeyRound, Copy, Check, Building2 } from 'lucide-react'
import { api } from '../../utils/api'
import type { User, Department } from '../../types'

const ROLE_CHIPS: Record<string, string> = {
  PLATFORM_MANAGER: 'chip bg-purple-100 text-purple-700 border border-purple-200',
  HR: 'chip chip-primary',
  MANAGER: 'chip chip-success',
  SUPERVISOR: 'chip chip-warning',
  AGENT: 'chip chip-gray',
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_MANAGER: 'Administrateur',
  HR: 'Ressources Humaines',
  MANAGER: 'Manager',
  SUPERVISOR: 'Superviseur',
  AGENT: 'Agent',
}

type CreateForm = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
  departmentId: string
}

type EditForm = {
  firstName: string
  lastName: string
  email: string
  role: string
  departmentId: string
  isActive: boolean
}

const emptyForm: CreateForm = {
  firstName: '', lastName: '', email: '', password: '',
  role: 'AGENT', departmentId: ''
}

type ImportResult = {
  created: number
  errors: { row: number; error: string }[]
}

const CSV_TEMPLATE = `firstName,lastName,email,role,departmentId
Jean,Dupont,jean.dupont@example.com,AGENT,
Marie,Louis,marie.louis@example.com,SUPERVISOR,
Pierre,Jean,pierre.jean@example.com,MANAGER,`

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState<CreateForm>({ ...emptyForm })
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ firstName: '', lastName: '', email: '', role: 'AGENT', departmentId: '', isActive: true })
  const [editError, setEditError] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDept, setShowBulkDept] = useState(false)
  const [bulkDepartmentId, setBulkDepartmentId] = useState('')
  const [bulkError, setBulkError] = useState('')

  // CSV Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const { data, isLoading } = useQuery<{ users: User[]; total: number; pages: number }>({
    queryKey: ['admin-users', debounced, page],
    queryFn: () => api.get(`/users?search=${debounced}&page=${page}&limit=20`).then(r => r.data)
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments').then(r => r.data),
    enabled: showCreate || !!editingUser || showBulkDept
  })

  const createUser = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/users', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreate(false)
      setForm({ ...emptyForm })
      setError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erreur lors de la creation')
    }
  })

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/users/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingUser(null)
      setEditError('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setEditError(msg || 'Erreur lors de la mise a jour')
    }
  })

  const resetPassword = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`).then(r => r.data),
    onSuccess: (data) => setTempPassword(data.tempPassword),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setEditError(msg || 'Erreur lors de la réinitialisation')
    }
  })

  const bulkUpdateDepartment = useMutation({
    mutationFn: (data: { userIds: string[]; departmentId: string | null }) =>
      api.patch('/users/bulk-department', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowBulkDept(false)
      setBulkDepartmentId('')
      setBulkError('')
      setSelectedIds(new Set())
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setBulkError(msg || 'Erreur lors de la mise à jour en masse')
    }
  })

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const importUsers = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post('/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => r.data as ImportResult)
    },
    onSuccess: (result) => {
      setImportResult(result)
      if (result.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setImportResult({ created: 0, errors: [{ row: 0, error: msg || "Erreur lors de l'importation" }] })
    }
  })

  function handleSearch(v: string) {
    setSearch(v)
    clearTimeout((window as unknown as { _ust?: ReturnType<typeof setTimeout> })._ust)
    ;(window as unknown as { _ust?: ReturnType<typeof setTimeout> })._ust = setTimeout(() => { setDebounced(v); setPage(1); setSelectedIds(new Set()) }, 300)
  }

  const pageUsers = data?.users ?? []
  const allPageSelected = pageUsers.length > 0 && pageUsers.every(u => selectedIds.has(u.id))

  function toggleSelectUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageUsers.forEach(u => next.delete(u.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageUsers.forEach(u => next.add(u.id))
        return next
      })
    }
  }

  function openBulkDeptModal() {
    setBulkDepartmentId('')
    setBulkError('')
    setShowBulkDept(true)
  }

  function handleBulkDeptSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBulkError('')
    if (selectedIds.size === 0) return
    bulkUpdateDepartment.mutate({
      userIds: [...selectedIds],
      departmentId: bulkDepartmentId || null
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Tous les champs obligatoires doivent etre remplis')
      return
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres')
      return
    }
    createUser.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      departmentId: form.departmentId || undefined
    })
  }

  function updateField(field: keyof CreateForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ─── CSV Import handlers ────────────────────────────────────────────────────

  function openImportModal() {
    setShowImport(true)
    setSelectedFile(null)
    setImportResult(null)
  }

  function closeImportModal() {
    setShowImport(false)
    setSelectedFile(null)
    setImportResult(null)
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setImportResult({ created: 0, errors: [{ row: 0, error: 'Seuls les fichiers CSV sont acceptes' }] })
      return
    }
    setSelectedFile(file)
    setImportResult(null)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file)
  }, [])

  function handleImportSubmit() {
    if (!selectedFile) return
    importUsers.mutate(selectedFile)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setEditError('')
    setTempPassword('')
    setCopied(false)
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      departmentId: user.department?.id ?? '',
      isActive: user.isActive,
    })
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setEditError('')
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      setEditError('Prénom, nom et email sont obligatoires')
      return
    }
    updateUser.mutate({
      id: editingUser.id,
      data: {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        departmentId: editForm.departmentId || undefined,
        isActive: editForm.isActive,
      }
    })
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele-import-utilisateurs.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users size={20} className="text-primary-600" /> Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} utilisateurs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openImportModal} className="btn-ghost text-sm flex items-center gap-1.5 border border-gray-200">
            <Upload size={14} /> Importer CSV
          </button>
          <button onClick={() => { setShowCreate(true); setError('') }} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* ─── CSV Import Modal ─── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeImportModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload size={18} className="text-primary-600" /> Importer des utilisateurs
              </h2>
              <button onClick={closeImportModal} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Template download */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-800">Format attendu du fichier CSV</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Colonnes : <code className="bg-blue-100 px-1 rounded">firstName</code>, <code className="bg-blue-100 px-1 rounded">lastName</code>, <code className="bg-blue-100 px-1 rounded">email</code>, <code className="bg-blue-100 px-1 rounded">role</code>, <code className="bg-blue-100 px-1 rounded">departmentId</code> (optionnel)
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Roles : PLATFORM_MANAGER, HR, MANAGER, SUPERVISOR, AGENT
                    </p>
                    <button onClick={downloadTemplate} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors">
                      <Download size={12} /> Telecharger le modele
                    </button>
                  </div>
                </div>
              </div>

              {/* Dropzone */}
              {!importResult && (
                <>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-primary-400 bg-primary-50'
                        : selectedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => handleFileSelect(e.target.files?.[0])}
                    />
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle size={24} className="text-green-500" />
                        <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                        <p className="text-xs text-green-500">{(selectedFile.size / 1024).toFixed(1)} Ko</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-gray-400" />
                        <p className="text-sm text-gray-500">Glissez un fichier CSV ici ou cliquez pour parcourir</p>
                        <p className="text-xs text-gray-400">Taille max : 5 Mo</p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    Mot de passe par defaut : <code className="bg-gray-100 px-1.5 py-0.5 rounded">LernvoWelcome2026!</code>
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleImportSubmit}
                      disabled={!selectedFile || importUsers.isPending}
                      className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {importUsers.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Importer
                    </button>
                    <button type="button" onClick={closeImportModal} className="btn-ghost py-2.5 text-sm px-4">
                      Annuler
                    </button>
                  </div>
                </>
              )}

              {/* Import Results */}
              {importResult && (
                <div className="space-y-3">
                  {/* Success summary */}
                  {importResult.created > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle size={18} className="text-green-600 shrink-0" />
                      <p className="text-sm font-medium text-green-800">
                        {importResult.created} utilisateur{importResult.created > 1 ? 's' : ''} cree{importResult.created > 1 ? 's' : ''} avec succes
                      </p>
                    </div>
                  )}

                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-red-600 shrink-0" />
                        <p className="text-sm font-medium text-red-800">
                          {importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600">
                            {err.row > 0 ? `Ligne ${err.row} : ` : ''}{err.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No results at all */}
                  {importResult.created === 0 && importResult.errors.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                      <AlertTriangle size={18} className="text-yellow-600 shrink-0" />
                      <p className="text-sm font-medium text-yellow-800">Aucun utilisateur cree. Verifiez le format du fichier.</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={closeImportModal} className="btn-primary flex-1 py-2.5 text-sm">
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Create User Modal ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus size={18} className="text-primary-600" /> Nouvel utilisateur
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Prenom <span className="text-red-400">*</span></label>
                  <input value={form.firstName} onChange={e => updateField('firstName', e.target.value)}
                    placeholder="Jean" autoFocus
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nom <span className="text-red-400">*</span></label>
                  <input value={form.lastName} onChange={e => updateField('lastName', e.target.value)}
                    placeholder="Dupont"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email <span className="text-red-400">*</span></label>
                <input value={form.email} onChange={e => updateField('email', e.target.value)}
                  type="email" placeholder="jean.dupont@example.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Mot de passe <span className="text-red-400">*</span></label>
                <input value={form.password} onChange={e => updateField('password', e.target.value)}
                  type="password" placeholder="Minimum 8 caracteres"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Role <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select value={form.role} onChange={e => updateField('role', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 appearance-none pr-8">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Departement</label>
                <div className="relative">
                  <select value={form.departmentId} onChange={e => updateField('departmentId', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 appearance-none pr-8">
                    <option value="">-- Aucun departement --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.name}{d.parentId ? '' : ' *'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createUser.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {createUser.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Creer l'utilisateur
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="btn-ghost py-2.5 text-sm px-4">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10" placeholder="Rechercher..." value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-primary-800">
            {selectedIds.size} utilisateur{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={openBulkDeptModal} className="btn-primary text-sm flex items-center gap-1.5">
              <Building2 size={14} /> Changer le département
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-sm">
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  aria-label="Tout sélectionner sur cette page"
                />
              </th>
              <th className="px-4 py-3 text-left">Utilisateur</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Departement</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Points</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">Streak</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : pageUsers.map(user => (
              <tr key={user.id} className="hover:bg-primary-50 transition-colors cursor-pointer" onClick={() => openEdit(user)}>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleSelectUser(user.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label={`Sélectionner ${user.firstName} ${user.lastName}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm text-gray-500">{user.department?.name ?? '--'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={ROLE_CHIPS[user.role] ?? 'chip chip-gray'}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-sm font-bold text-yellow-500">{user.totalPoints.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-sm text-orange-400">{user.currentStreak > 0 ? `${user.currentStreak}` : '--'}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={user.isActive ? 'chip chip-success' : 'chip chip-danger'}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                    <Pencil size={13} className="text-gray-300 group-hover:text-primary-500 hidden sm:block" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(data?.pages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedIds(new Set()) }} disabled={page === 1} className="btn-ghost text-xs">Precedent</button>
            <span className="text-xs text-gray-400">Page {page} / {data?.pages}</span>
            <button onClick={() => { setPage(p => Math.min(data?.pages ?? 1, p + 1)); setSelectedIds(new Set()) }} disabled={page === data?.pages} className="btn-ghost text-xs">Suivant</button>
          </div>
        )}
      </div>

      {/* ─── Bulk Department Modal ─── */}
      {showBulkDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowBulkDept(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 size={18} className="text-primary-600" /> Changer le département
              </h2>
              <button onClick={() => setShowBulkDept(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleBulkDeptSubmit} className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Mettre à jour le département de <strong>{selectedIds.size}</strong> utilisateur{selectedIds.size > 1 ? 's' : ''}.
              </p>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Département</label>
                <div className="relative">
                  <select
                    value={bulkDepartmentId}
                    onChange={e => setBulkDepartmentId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 appearance-none pr-8"
                    autoFocus
                  >
                    <option value="">-- Aucun département --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.name}{d.parentId ? '' : ' *'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {bulkError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
                  {bulkError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={bulkUpdateDepartment.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {bulkUpdateDepartment.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Appliquer
                </button>
                <button type="button" onClick={() => setShowBulkDept(false)} className="btn-ghost py-2.5 text-sm px-4">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit User Modal ─── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pencil size={18} className="text-primary-600" /> Modifier l'utilisateur
              </h2>
              <button onClick={() => setEditingUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Prenom <span className="text-red-400">*</span></label>
                  <input value={editForm.firstName} onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nom <span className="text-red-400">*</span></label>
                  <input value={editForm.lastName} onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email <span className="text-red-400">*</span></label>
                <input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  type="email"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50" />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Role <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 appearance-none pr-8">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Departement</label>
                <div className="relative">
                  <select value={editForm.departmentId} onChange={e => setEditForm(p => ({ ...p, departmentId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 appearance-none pr-8">
                    <option value="">-- Aucun departement --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.name}{d.parentId ? '' : ' *'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Active status toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Compte actif</div>
                  <div className="text-xs text-gray-400">Desactiver empechera la connexion</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editForm.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Reset password */}
              <div className="border-t border-gray-100 pt-4">
                {tempPassword ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-700">Mot de passe temporaire — à communiquer à l'employé :</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-mono text-amber-900 select-all">
                        {tempPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(tempPassword)}
                        className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors shrink-0"
                        title="Copier"
                      >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-amber-700" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-600">L'employé devra changer ce mot de passe depuis son profil.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editingUser && resetPassword.mutate(editingUser.id)}
                    disabled={resetPassword.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {resetPassword.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    Réinitialiser le mot de passe
                  </button>
                )}
              </div>

              {/* Error */}
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
                  {editError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={updateUser.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {updateUser.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="btn-ghost py-2.5 text-sm px-4">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
