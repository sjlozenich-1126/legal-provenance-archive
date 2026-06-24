'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; 

// ─── SACS TAXONOMY MATRIX CONFIGURATION ──────────────────────────
const SACS_SYSTEMS = [
  { code: 'JUD', label: 'Judicial / Authority Layer' },
  { code: 'OPS', label: 'Operations / Execution Layer' },
  { code: 'LOG', label: 'Logistics / Ledger Flow' },
  { code: 'SEC', label: 'Security / Perimeter Monitor' }
];

const SACS_DOMAINS = [
  { code: 'SUP', label: 'Supervisory Control' },
  { code: 'POL', label: 'Policy Enforcement' },
  { code: 'DAT', label: 'Data / Ledger Stratum' },
  { code: 'NET', label: 'Network / Communication' }
];

const SACS_ROLES = [
  { code: 'INV', label: 'Investigation / Audit' },
  { code: 'INI', label: 'Initialization / Anchor' },
  { code: 'VAL', label: 'Validation / Consensus' },
  { code: 'REP', label: 'Reporting / Broadcast' }
];

const SACS_FAILURES = [
  { code: 'C.AU', label: 'Critical - Authority Breach' },
  { code: 'M.DA', label: 'Major - Data Mutation' },
  { code: 'L.DL', label: 'Minor - Delay / Latency' },
  { code: 'C.EX', label: 'Critical - External Compromise' }
];
// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────
interface LedgerDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  hash: string;
  collectionId?: string;
  tags: string[];
  docType: string;        
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCLASSIFIED';
  dateAdded: string;
  description: string;   
  isFlagged: boolean;    
  isArchived: boolean;   
}

interface CollectionItem {
  id: string;
  name: string;
  code: string;
  color: string;         
  description: string;  
  dateCreated: string;
}

interface SecurityIncident {
  id: string;
  sacsCode: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  xAxis: string;
  yAxis: string;
  zAxis: string;
  targetSubject: string;
  clearanceTier: string;
  scopeFlags: string;
  sensoryInput: string;
  perceptualPhenomenon: string; // Generalized from auditoryPhenomenon
  environmentalContext: string;
  status: string;
  timestamp: string;
  attachedDocIds: string[];
  tags: string[];        
  isArchived: boolean;   
}

interface IntelligenceBriefing {
  id: string;
  title: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  classification: string;
  cycle: string;
  analyst: string;
  nutGraf: string;
  keyJudgments: string;
  headline: string;
  fact: string;
  implications: string;
  alternatives: string;
  sourceDocId: string;
  horizon: string;
  actionItems: string;
  timestamp: string;
  tags: string[];        
  isArchived: boolean;   
}

interface CaseStudyRecord {
  id: string;
  caseNumber: string;
  cause: string;
  judge: string;
  parties: string;
  incarcerationDates: string;
  dispositionStatus: string;
  institutionalCompressionContext: string;
  evidentiaryMemoryGaps: string;
  technologicalVariables: string;
  proceduralAnalysisMarkdown: string;
  timestamp: string;
  attachedDocIds: string[];
  tags: string[];        
  isArchived: boolean;   
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  targetId: string;
  targetType: 'document' | 'incident' | 'briefing' | 'case' | 'collection';
  detail: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const BLUE = '#066cf4';
const BLUE_LIGHT = '#E6F0FE';
const BLUE_TEXT = '#033A85';
const RED = '#DC2626';
const ORANGE = '#EA580C';
const AMBER = '#F59E0B';
const GREEN = '#16A34A';
const GRAY = '#6B7280';

const DOC_TYPES = ['Evidence', 'Legal Filing', 'Forensic Report', 'Intelligence Report', 'Correspondence', 'Court Record', 'Media / Audio', 'Technical Specification', 'Administrative Record', 'Other'];
const PRIORITY_COLORS: Record<string, string> = { CRITICAL: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: GREEN, UNCLASSIFIED: GRAY };
const COLLECTION_PALETTE = ['#066cf4', '#7c3aed', '#0891b2', '#16a34a', '#dc2626', '#ea580c', '#9333ea', '#0f766e'];

const DEFAULT_COLLECTIONS: CollectionItem[] = [
  { id: 'col-1', name: 'Operational Base Alpha', code: 'CTS-A', color: '#066cf4', description: 'Primary operational documents', dateCreated: '2026-01-01' },
  { id: 'col-2', name: 'King County Forensics', code: 'KCF-02', color: '#dc2626', description: 'Forensic and evidentiary records', dateCreated: '2026-01-01' },
];

const getSecureTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
const getDateStr = () => new Date().toISOString().split('T')[0];

const calculateSHA256 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const priorityWeight = (p: string) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNCLASSIFIED: 0 }[p] ?? 0);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Page() {
  const [activeTab, setActiveTab] = useState<'vault' | 'incidents' | 'briefings' | 'cases' | 'audit'>('vault');

 // Registry state
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [documentsVault, setDocumentsVault] = useState<LedgerDocument[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [briefingsArchive, setBriefingsArchive] = useState<IntelligenceBriefing[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudyRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [initialHydration, setInitialHydration] = useState(false);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true); // 💡 Added tracking variable

  // ─── FETCH HISTORICAL LEDGER ENTRIES FROM SUPABASE ────────────────────────
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        setIsLoadingIncidents(true);
        
        const { data, error } = await supabase
          .from('sacs_incidents')
          .select('*')
          .order('created_at', { ascending: false }); // Pull newest entries first

        if (error) throw error;
        
        // If your database uses snake_case, map fields back to your UI type format if necessary
        if (data) {
          const mappedData = data.map((row: any) => ({
            id: row.id,
            sacsCode: row.sacs_code,
            priority: row.priority,
            xAxis: row.x_axis,
            yAxis: row.y_axis,
            zAxis: row.z_axis,
            targetSubject: row.target_subject,
            clearanceTier: row.clearance_tier,
            scopeFlags: row.scope_flags,
            sensoryInput: row.sensory_input,
            perceptualPhenomenon: row.perceptual_phenomenon,
            environmentalContext: row.environmental_context,
            status: row.status,
            timestamp: row.created_at,
            attachedDocIds: row.attached_doc_ids || [],
            tags: row.tags || [],
            isArchived: row.is_archived
          }));
          setIncidents(mappedData);
        }
        
      } catch (err) {
        console.error('Error syncing historical registry:', err);
      } finally {
        setIsLoadingIncidents(false);
      }
    };

    fetchIncidents();
  }, []); // Fires exactly once when the component builds

  // Vault filters & search
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState('ALL');
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultDocTypeFilter, setVaultDocTypeFilter] = useState('ALL');
  const [vaultPriorityFilter, setVaultPriorityFilter] = useState('ALL');
  const [vaultSortBy, setVaultSortBy] = useState<'date' | 'name' | 'priority' | 'type'>('date');
  const [vaultSortDir, setVaultSortDir] = useState<'asc' | 'desc'>('desc');
  const [showArchivedDocs, setShowArchivedDocs] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [vaultTagFilter, setVaultTagFilter] = useState('');

  // Incident filters
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [showArchivedIncidents, setShowArchivedIncidents] = useState(false);

  // Briefing filters
  const [briefingSearch, setBriefingSearch] = useState('');
  const [showArchivedBriefings, setShowArchivedBriefings] = useState(false);

  // Case filters
  const [caseSearch, setCaseSearch] = useState('');
  const [showArchivedCases, setShowArchivedCases] = useState(false);

  // Active/selected
  const [activeDoc, setActiveDoc] = useState<LedgerDocument | null>(null);
  const [activeBrief, setActiveBrief] = useState<IntelligenceBriefing | null>(null);
  const [activeCaseStudy, setActiveCaseStudy] = useState<CaseStudyRecord | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]); 

  // Upload state
  const [uploadCollectionTarget, setUploadCollectionTarget] = useState('CENTRAL');
  const [uploadDocType, setUploadDocType] = useState('Evidence');
  const [uploadPriority, setUploadPriority] = useState<LedgerDocument['priority']>('UNCLASSIFIED');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null); 

  // Collection modal
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColCode, setNewColCode] = useState('');
  const [newColColor, setNewColColor] = useState(COLLECTION_PALETTE[0]);
  const [newColDescription, setNewColDescription] = useState('');

  // Bulk action
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTargetCollection, setBulkTargetCollection] = useState('CENTRAL');

  // Tag input for doc editing
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocTags, setEditDocTags] = useState('');
  const [editDocDescription, setEditDocDescription] = useState('');

  // SACS Incident form
  const [sacsSystem, setSacsSystem] = useState('JUD');
  const [sacsDomain, setSacsDomain] = useState('POL');
  const [sacsRole, setSacsRole] = useState('INI');
  const [sacsFunction, setSacsFunction] = useState('INV');
  const [sacsRisk, setSacsRisk] = useState('C');
  const [sacsFailure, setSacsFailure] = useState('AU');
  const [incPriority, setIncPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [zAxis, setZAxis] = useState('Category 4');
  const [targetSubject, setTargetSubject] = useState('');
  const [clearanceTier, setClearanceTier] = useState('TIER-3');
  const [scopeFlags, setScopeFlags] = useState('');
  const [sensoryInput, setSensoryInput] = useState('');
  const [perceptualPhenomenon, setPerceptualPhenomenon] = useState(''); // Generalized Name
  const [environmentalContext, setEnvironmentalContext] = useState('');
  const [incidentDocAttachments, setIncidentDocAttachments] = useState<string[]>([]);
  const [incidentTags, setIncidentTags] = useState('');

  // Briefing form
  const [briefTitle, setBriefTitle] = useState('');
  const [briefPriority, setBriefPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [briefClassification, setBriefClassification] = useState('SECRET // EYES ONLY');
  const [briefCycle, setBriefCycle] = useState('23 JUN 2026 / 0800 EDT / DAILY');
  const [briefAnalyst, setBriefAnalyst] = useState('CTS DEFENSE OPERATIONS CELL');
  const [briefNutGraf, setBriefNutGraf] = useState('');
  const [briefKeyJudgments, setBriefKeyJudgments] = useState('');
  const [briefHeadline, setBriefHeadline] = useState('');
  const [briefFact, setBriefFact] = useState('');
  const [briefImplications, setBriefImplications] = useState('');
  const [briefAlternatives, setBriefAlternatives] = useState('');
  const [briefSourceDocId, setBriefSourceDocId] = useState('');
  const [briefHorizon, setBriefHorizon] = useState('');
  const [briefActionItems, setBriefActionItems] = useState('');
  const [briefTags, setBriefTags] = useState('');

  // Case Study form
  const [csNumber, setCsNumber] = useState('');
  const [csCause, setCsCause] = useState('');
  const [csJudge, setCsJudge] = useState('');
  const [csParties, setCsParties] = useState('');
  const [csIncarceration, setCsIncarceration] = useState('');
  const [csDisposition, setCsDisposition] = useState('');
  const [csCompression, setCsCompression] = useState('');
  const [csMemoryGaps, setCsMemoryGaps] = useState('');
  const [csVariables, setCsVariables] = useState('');
  const [csAnalysis, setCsAnalysis] = useState('');
  const [csDocAttachments, setCsDocAttachments] = useState<string[]>([]);
  const [csTags, setCsTags] = useState('');

  // ─── AUDIT LOG ─────────────────────────────────────────────────────────────
  const addAudit = useCallback((action: string, targetId: string, targetType: AuditEntry['targetType'], detail: string) => {
    setAuditLog(prev => [{
      id: `AUDIT-${Date.now()}`,
      timestamp: getSecureTimestamp(),
      action, targetId, targetType, detail
    }, ...prev].slice(0, 500));
  }, []);

  // ─── STORAGE PERSISTENCE ENGINE (HYBRID CLOUD/LOCAL LAYER) ───────────────────
  useEffect(() => {
    async function hydrateFromBackend() {
      // 1. First, hydrate the local items from localStorage as usual
      try {
        const storedCols = localStorage.getItem('cts_collections_v2');
        const storedDocs = localStorage.getItem('cts_docs_v2');
        const storedCases = localStorage.getItem('cts_cases_v2');
        const storedAudit = localStorage.getItem('cts_audit');

        if (storedCols) setCollections(JSON.parse(storedCols));
        else { setCollections(DEFAULT_COLLECTIONS); localStorage.setItem('cts_collections_v2', JSON.stringify(DEFAULT_COLLECTIONS)); }
        
        if (storedDocs) setDocumentsVault(JSON.parse(storedDocs));
        if (storedCases) setCaseStudies(JSON.parse(storedCases));
        if (storedAudit) setAuditLog(JSON.parse(storedAudit));
      } catch (e) { 
        console.error('Local hydration fault:', e); 
      }

      // 2. Next, fetch the live cloud records asynchronously from Supabase
      try {
        const { data: dbBriefs, error: briefErr } = await supabase
          .from('intelligence_briefings')
          .select('*')
          .order('created_at', { ascending: false });

        if (briefErr) console.error('Error fetching briefings:', briefErr);

        const { data: dbIncidents, error: incErr } = await supabase
          .from('sacs_incidents')
          .select('*')
          .order('created_at', { ascending: false });

        if (incErr) console.error('Error fetching incidents:', incErr);

        if (dbBriefs) {
          const mappedBriefs = dbBriefs.map(b => ({
            id: b.id,
            title: b.title,
            priority: b.priority,
            classification: b.classification,
            cycle: b.cycle,
            analyst: b.analyst,
            nutGraf: b.nut_graf,
            keyJudgments: b.key_judgments,
            headline: b.headline,
            fact: b.fact,
            implications: b.implications,
            alternatives: b.alternatives,
            sourceDocId: b.source_doc_id,
            horizon: b.horizon,
            actionItems: b.action_items,
            tags: b.tags || [],
            isArchived: b.is_archived,
            timestamp: new Date(b.created_at).toLocaleString()
          }));
          setBriefingsArchive(mappedBriefs);
        }

        if (dbIncidents) {
          const mappedIncidents = dbIncidents.map(i => ({
            id: i.id,
            sacsCode: i.sacs_code,
            priority: i.priority,
            xAxis: i.x_axis,
            yAxis: i.y_axis,
            zAxis: i.z_axis,
            targetSubject: i.target_subject,
            clearanceTier: i.clearance_tier,
            scopeFlags: i.scope_flags,
            sensoryInput: i.sensory_input,
            perceptualPhenomenon: i.perceptual_phenomenon,
            environmentalContext: i.environmental_context,
            status: i.status,
            attachedDocIds: i.attached_doc_ids || [],
            tags: i.tags || [],
            isArchived: i.is_archived,
            timestamp: new Date(i.created_at).toLocaleString()
          }));
          setIncidents(mappedIncidents);
        }
      } catch (fault) {
        console.error('Stratum cloud connection fault during sync:', fault);
      }
      
      setInitialHydration(true);
    }

    hydrateFromBackend();
  }, []);

  // 3. Keep local storage auto-save observers ONLY for non-cloud arrays
  useEffect(() => { if (initialHydration) localStorage.setItem('cts_docs_v2', JSON.stringify(documentsVault)); }, [documentsVault, initialHydration]);
  useEffect(() => { if (initialHydration) localStorage.setItem('cts_cases_v2', JSON.stringify(caseStudies)); }, [caseStudies, initialHydration]);
  useEffect(() => { if (initialHydration) localStorage.setItem('cts_audit', JSON.stringify(auditLog)); }, [auditLog, initialHydration]);
  useEffect(() => { if (initialHydration) localStorage.setItem('cts_collections_v2', JSON.stringify(collections)); }, [collections, initialHydration]);

  // ─── DOCUMENT VAULT ACTIONS ───────────────────────────────────────────────
  const parseTags = (raw: string): string[] =>
    raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsHashing(true);
    const newDocs: LedgerDocument[] = [];

    for (const file of Array.from(files)) {
      try {
        const computedHash = await calculateSHA256(file);
        const doc: LedgerDocument = {
          id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file),
          hash: computedHash,
          collectionId: uploadCollectionTarget === 'CENTRAL' ? undefined : uploadCollectionTarget,
          tags: parseTags(uploadTags),
          docType: uploadDocType,
          priority: uploadPriority,
          dateAdded: getDateStr(),
          description: uploadDescription,
          isFlagged: false,
          isArchived: false,
          };
          newDocs.push(doc);
          addAudit('UPLOAD', doc.id, 'document', `Uploaded "${file.name}" — SHA-256: ${computedHash.substring(0, 16)}...`);
        } catch (err) {
          console.error('Hashing error:', err);
        }
      }

      setDocumentsVault(prev => [...newDocs, ...prev]);
      if (newDocs.length === 1) setActiveDoc(newDocs[0]);
      setUploadTags(''); setUploadDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
      setIsHashing(false);
    };

    const reallocateDocCollection = (docId: string, targetColId: string) => {
      const colName = targetColId === 'CENTRAL' ? 'Central Repository' : collections.find(c => c.id === targetColId)?.name || targetColId;
      setDocumentsVault(prev => prev.map(d =>
        d.id === docId ? { ...d, collectionId: targetColId === 'CENTRAL' ? undefined : targetColId } : d
      ));
      if (activeDoc?.id === docId) setActiveDoc(prev => prev ? { ...prev, collectionId: targetColId === 'CENTRAL' ? undefined : targetColId } : null);
      addAudit('REALLOCATE', docId, 'document', `Moved to collection: ${colName}`);
    };

    const toggleDocFlag = (docId: string) => {
      setDocumentsVault(prev => prev.map(d => d.id === docId ? { ...d, isFlagged: !d.isFlagged } : d));
      if (activeDoc?.id === docId) setActiveDoc(prev => prev ? { ...prev, isFlagged: !prev.isFlagged } : null);
    };

    const toggleDocArchive = (docId: string) => {
      setDocumentsVault(prev => prev.map(d => d.id === docId ? { ...d, isArchived: !d.isArchived } : d));
      if (activeDoc?.id === docId) setActiveDoc(null);
      addAudit('ARCHIVE_TOGGLE', docId, 'document', 'Archive status toggled');
    };

    const deleteDoc = (docId: string) => {
      if (!confirm('Permanently delete this document from the ledger?')) return;
      setDocumentsVault(prev => prev.filter(d => d.id !== docId));
      if (activeDoc?.id === docId) setActiveDoc(null);
      addAudit('DELETE', docId, 'document', 'Document permanently deleted');
    };

    const saveDocEdits = (docId: string) => {
      setDocumentsVault(prev => prev.map(d =>
        d.id === docId ? { ...d, tags: parseTags(editDocTags), description: editDocDescription } : d
      ));
      if (activeDoc?.id === docId) setActiveDoc(prev => prev ? { ...prev, tags: parseTags(editDocTags), description: editDocDescription } : null);
      setEditingDocId(null);
      addAudit('EDIT_METADATA', docId, 'document', 'Tags and description updated');
    };

    const toggleBulkSelect = (id: string) =>
      setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const selectAllFiltered = () => setSelectedDocIds(filteredAndSortedDocs.map(d => d.id));
    const clearSelection = () => setSelectedDocIds([]);

    const bulkReallocate = () => {
      const colName = bulkTargetCollection === 'CENTRAL' ? 'Central Repository' : collections.find(c => c.id === bulkTargetCollection)?.name || bulkTargetCollection;
      setDocumentsVault(prev => prev.map(d =>
        selectedDocIds.includes(d.id) ? { ...d, collectionId: bulkTargetCollection === 'CENTRAL' ? undefined : bulkTargetCollection } : d
      ));
      addAudit('BULK_REALLOCATE', selectedDocIds.join(','), 'document', `${selectedDocIds.length} docs moved to ${colName}`);
      setSelectedDocIds([]);
      setShowBulkActions(false);
    };

    const bulkArchive = () => {
      setDocumentsVault(prev => prev.map(d => selectedDocIds.includes(d.id) ? { ...d, isArchived: true } : d));
      addAudit('BULK_ARCHIVE', selectedDocIds.join(','), 'document', `${selectedDocIds.length} docs archived`);
      setSelectedDocIds([]);
    };

    const bulkFlag = () => {
      setDocumentsVault(prev => prev.map(d => selectedDocIds.includes(d.id) ? { ...d, isFlagged: true } : d));
      setSelectedDocIds([]);
    };

    const exportVaultIndex = () => {
      const exportData = { exportedAt: getSecureTimestamp(), totalDocuments: documentsVault.length, collections, documents: documentsVault.map(d => ({ ...d, url: '[OBJECT URL — NOT EXPORTABLE]' })) };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `CTS_VaultIndex_${getDateStr()}.json`; a.click();
      addAudit('EXPORT', 'VAULT', 'document', 'Full vault index exported as JSON');
    };

  // ─── COLLECTION ACTIONS ───────────────────────────────────────────────────
  const handleSaveCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName || !newColCode) return;
    if (editingCollection) {
      const updated = collections.map(c => c.id === editingCollection.id
        ? { ...c, name: newColName, code: newColCode.toUpperCase(), color: newColColor, description: newColDescription }
        : c);
      setCollections(updated);
      addAudit('EDIT_COLLECTION', editingCollection.id, 'collection', `Collection updated: ${newColName}`);
    } else {
      const newCol: CollectionItem = { id: `col-${Date.now()}`, name: newColName, code: newColCode.toUpperCase(), color: newColColor, description: newColDescription, dateCreated: getDateStr() };
      setCollections(prev => [...prev, newCol]);
      addAudit('CREATE_COLLECTION', newCol.id, 'collection', `New collection: ${newColName} [${newColCode.toUpperCase()}]`);
    }
    setShowNewCollection(false); setEditingCollection(null);
    setNewColName(''); setNewColCode(''); setNewColColor(COLLECTION_PALETTE[0]); setNewColDescription('');
  };

  const openEditCollection = (col: CollectionItem) => {
    setEditingCollection(col);
    setNewColName(col.name); setNewColCode(col.code); setNewColColor(col.color); setNewColDescription(col.description);
    setShowNewCollection(true);
  };

  const deleteCollection = (colId: string) => {
    if (!confirm('Delete this collection? Documents will be moved to Central Repository.')) return;
    setCollections(prev => prev.filter(c => c.id !== colId));
    setDocumentsVault(prev => prev.map(d => d.collectionId === colId ? { ...d, collectionId: undefined } : d));
    if (selectedCollectionFilter === colId) setSelectedCollectionFilter('ALL');
    addAudit('DELETE_COLLECTION', colId, 'collection', 'Collection deleted; documents moved to Central');
  };

 /// ─── LEDGER LOGGING TRANSACTIONS ───────────────────────────────────────────
  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();

    const runtimeCode = `${sacsSystem}.${sacsDomain}.${sacsRole}.${sacsFunction}.${sacsRisk}.${sacsFailure}`;

  // Map your frontend form states directly to your exact database columns
    const payload = {
      sacs_code: runtimeCode,
      priority: incPriority,
      clearance_tier: clearanceTier,
      target_subject: targetSubject,
      scope_flags: scopeFlags,
      x_axis: xAxis,
      y_axis: yAxis,
      z_axis: zAxis,
      sensory_input: sensoryInput,
      perceptual_phenomenon: perceptualPhenomenon,
      environmental_context: environmentalContext,
      status: 'Open',
      created_at: new Date().toISOString(), // 💡 CHANGED FROM timestamp TO created_at
      attached_doc_ids: incidentDocAttachments,
      tags: incidentTags.split(',').map(t => t.trim()).filter(Boolean),
      is_archived: false
    };

    try {
      // Commit the payload directly to the database
      const { data, error } = await supabase
        .from('sacs_incidents')
        .insert([payload])
        .select();

      if (error) throw error;

      // 💡 FIXED: References database snake_case structure on data object
      if (data && data[0]) {
        const row = data[0];
        const cleanIncident: SecurityIncident = {
          id: row.id,
          sacsCode: row.sacs_code,
          priority: row.priority,
          xAxis: row.x_axis,
          yAxis: row.y_axis,
          zAxis: row.z_axis,
          targetSubject: row.target_subject,
          clearanceTier: row.clearance_tier,
          scopeFlags: row.scope_flags,
          sensoryInput: row.sensory_input,
          perceptualPhenomenon: row.perceptual_phenomenon,
          environmentalContext: row.environmental_context,
          status: row.status,
          timestamp: new Date(row.created_at).toLocaleString(),
          attachedDocIds: row.attached_doc_ids || [],
          tags: row.tags || [],
          isArchived: row.is_archived
        };
        setIncidents(prev => [cleanIncident, ...prev]);
        addAudit('CREATE_INCIDENT', cleanIncident.id, 'incident', `SACS Entry: ${runtimeCode} [${incPriority}]`);
      }

      // Reset form fields
      setXAxis(''); setYAxis(''); setTargetSubject(''); setScopeFlags(''); setSensoryInput('');
      setPerceptualPhenomenon(''); setIncidentDocAttachments([]); setIncidentTags('');

    } catch (err) {
      console.error('Error committing incident log entry:', err);
      alert('Database transaction failed. Check terminal for connectivity errors.');
    }
  };

  const toggleIncidentArchive = (id: string) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, isArchived: !i.isArchived } : i));
  };
// ─── VAULT DOCUMENT UPLOAD TRANSACTION ────────────────────────────────────
  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsHashing(true);
    const uploadedDocs: LedgerDocument[] = [];

    try {
      for (const file of files) {
        const computedHash = await calculateSHA256(file);
        const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
        const baseName = fileExt ? file.name.replace(new RegExp(`\\.${fileExt}$`), '') : file.name;
        const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '_') || 'document';
        const storagePath = `${Date.now()}_${cleanName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('vault-documents')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('vault-documents')
          .getPublicUrl(storagePath);

        const newDoc: LedgerDocument = {
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: file.type,
          url: urlData.publicUrl,
          hash: computedHash,
          collectionId: uploadCollectionTarget === 'CENTRAL' ? undefined : uploadCollectionTarget,
          tags: parseTags(uploadTags),
          docType: uploadDocType,
          priority: uploadPriority,
          dateAdded: getDateStr(),
          description: uploadDescription,
          isFlagged: false,
          isArchived: false
        };

        uploadedDocs.push(newDoc);
        addAudit('UPLOAD_DOCUMENT', newDoc.id, 'document', `Stored "${file.name}" - SHA-256: ${computedHash.substring(0, 16)}...`);
      }

      setDocumentsVault(prev => [...uploadedDocs, ...prev]);
      setIncidentDocAttachments(prev => [...prev, ...uploadedDocs.map(doc => doc.id)]);
      if (uploadedDocs.length === 1) setActiveDoc(uploadedDocs[0]);
      setUploadTags('');
      setUploadDescription('');
      alert(`Asset${uploadedDocs.length === 1 ? '' : 's'} successfully mirrored to cloud vault.`);
    } catch (err) {
      console.error('Vault infrastructure transfer failed:', err);
      alert('File upload rejected. Check storage policies and bucket name.');
    } finally {
      setIsHashing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };
 // ─── BRIEFING ACTIONS (SUPABASE TRANSACTION ENGINE) ───────────────────────
  const handleCommitBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Package internal fields into database snake_case column format
    const payload = {
      title: briefTitle || `Untitled Briefing (${new Date().toLocaleDateString()})`,
      priority: briefPriority,
      classification: briefClassification,
      cycle: briefCycle,
      analyst: briefAnalyst,
      nut_graf: briefNutGraf,
      key_judgments: briefKeyJudgments,
      headline: briefHeadline,
      fact: briefFact,
      implications: briefImplications,
      alternatives: briefAlternatives,
      source_doc_id: briefSourceDocId,
      horizon: briefHorizon,
      action_items: briefActionItems,
      tags: parseTags(briefTags),
      is_archived: false
    };

    const { data, error } = await supabase
      .from('intelligence_briefings')
      .insert([payload])
      .select();

    if (error) {
      console.error('Database write rejection:', error);
      alert(`Transaction aborted: ${error.message}`);
      return;
    }

    if (data && data[0]) {
      // Map the returned row directly back into your UI state
      const cleanRecord = {
        id: data[0].id,
        title: data[0].title,
        priority: data[0].priority,
        classification: data[0].classification,
        cycle: data[0].cycle,
        analyst: data[0].analyst,
        nutGraf: data[0].nut_graf,
        keyJudgments: data[0].key_judgments,
        headline: data[0].headline,
        fact: data[0].fact,
        implications: data[0].implications,
        alternatives: data[0].alternatives,
        sourceDocId: data[0].source_doc_id,
        horizon: data[0].horizon,
        actionItems: data[0].action_items,
        tags: data[0].tags || [],
        isArchived: data[0].is_archived,
        timestamp: new Date(data[0].created_at).toLocaleString()
      };

      setBriefingsArchive(prev => [cleanRecord, ...prev]);
      setActiveBrief(cleanRecord);
      addAudit('CREATE_BRIEFING', cleanRecord.id, 'briefing', `Intelligence Briefing: "${cleanRecord.title}" committed securely to cloud relational layer.`);
      
      // Reset input fields
      setBriefTitle(''); setBriefNutGraf(''); setBriefKeyJudgments(''); setBriefHeadline('');
      setBriefFact(''); setBriefImplications(''); setBriefAlternatives(''); setBriefHorizon('');
      setBriefActionItems(''); setBriefTags('');
    }
  };
  // ─── CASE STUDY ACTIONS ───────────────────────────────────────────────────
  const toggleBriefingArchive = (id: string) => {
    setBriefingsArchive(prev => prev.map(b => b.id === id ? { ...b, isArchived: !b.isArchived } : b));
    if (activeBrief?.id === id) {
      setActiveBrief(prev => prev ? { ...prev, isArchived: !prev.isArchived } : null);
    }
  };

  const handleCreateCaseStudy = (e: React.FormEvent) => {
    e.preventDefault();
    const study: CaseStudyRecord = {
      id: `CS-${Date.now()}`, caseNumber: csNumber || 'N/A', cause: csCause || 'General Non-Inscription Analysis',
      judge: csJudge || 'Unassigned', parties: csParties || 'Unspecified Parties',
      incarcerationDates: csIncarceration || 'N/A', dispositionStatus: csDisposition || 'Pending Administrative Review',
      institutionalCompressionContext: csCompression, evidentiaryMemoryGaps: csMemoryGaps,
      technologicalVariables: csVariables, proceduralAnalysisMarkdown: csAnalysis,
      timestamp: getSecureTimestamp(), attachedDocIds: csDocAttachments,
      tags: parseTags(csTags), isArchived: false
    };
    setCaseStudies(prev => [study, ...prev]);
    setActiveCaseStudy(study);
    addAudit('CREATE_CASE', study.id, 'case', `Case File No. ${study.caseNumber}: ${study.cause}`);
    setCsNumber(''); setCsCause(''); setCsJudge(''); setCsParties(''); setCsIncarceration('');
    setCsDisposition(''); setCsCompression(''); setCsMemoryGaps(''); setCsVariables('');
    setCsAnalysis(''); setCsDocAttachments([]); setCsTags('');
  };

  const toggleCaseArchive = (id: string) => {
    setCaseStudies(prev => prev.map(c => c.id === id ? { ...c, isArchived: !c.isArchived } : c));
  };

  // ─── FILTER & SORT LOGIC ──────────────────────────────────────────────────
  const filteredAndSortedDocs = (() => {
    let docs = documentsVault.filter(d => {
      if (!showArchivedDocs && d.isArchived) return false;
      if (showFlaggedOnly && !d.isFlagged) return false;
      if (selectedCollectionFilter === 'CENTRAL' && d.collectionId) return false;
      if (selectedCollectionFilter !== 'ALL' && selectedCollectionFilter !== 'CENTRAL' && d.collectionId !== selectedCollectionFilter) return false;
      if (vaultDocTypeFilter !== 'ALL' && d.docType !== vaultDocTypeFilter) return false;
      if (vaultPriorityFilter !== 'ALL' && d.priority !== vaultPriorityFilter) return false;
      if (vaultTagFilter && !d.tags.some(t => t.includes(vaultTagFilter.toUpperCase()))) return false;
      if (vaultSearch) {
        const q = vaultSearch.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.hash.includes(q) || d.tags.some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
    docs.sort((a, b) => {
      let cmp = 0;
      if (vaultSortBy === 'date') cmp = a.dateAdded.localeCompare(b.dateAdded);
      else if (vaultSortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (vaultSortBy === 'priority') cmp = priorityWeight(a.priority) - priorityWeight(b.priority);
      else if (vaultSortBy === 'type') cmp = a.docType.localeCompare(b.docType);
      return vaultSortDir === 'desc' ? -cmp : cmp;
    });
    return docs;
  })();

  const filteredIncidents = incidents.filter(i => {
    if (!showArchivedIncidents && i.isArchived) return false;
    if (incidentPriorityFilter !== 'ALL' && i.priority !== incidentPriorityFilter) return false;
    if (incidentSearch) {
      const q = incidentSearch.toLowerCase();
      return i.sacsCode.toLowerCase().includes(q) || i.targetSubject.toLowerCase().includes(q) || i.xAxis.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  }).sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

  const filteredBriefings = briefingsArchive.filter(b => {
    if (!showArchivedBriefings && b.isArchived) return false;
    if (briefingSearch) {
      const q = briefingSearch.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.analyst.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredCases = caseStudies.filter(c => {
    if (!showArchivedCases && c.isArchived) return false;
    if (caseSearch) {
      const q = caseSearch.toLowerCase();
      return c.caseNumber.toLowerCase().includes(q) || c.cause.toLowerCase().includes(q) || c.parties.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const allVaultTags = Array.from(new Set(documentsVault.flatMap(d => d.tags))).sort();

  const toggleIncidentAttachment = (id: string) =>
    setIncidentDocAttachments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleCaseAttachment = (id: string) =>
    setCsDocAttachments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const triggerPrintProtocol = () => window.print();

  // ─── STYLES ───────────────────────────────────────────────────────────────
  const s = {
    shell: { display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: '"Arimo", sans-serif', background: '#F7F7F6', color: '#111' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '52px', background: '#FFF', borderBottom: '1px solid #EBEBEB', position: 'sticky', top: 0, zIndex: 10 },
    logoGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
    logoAnchor: { display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', color: 'inherit' },
    logoText: { fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
    tabGroup: { display: 'flex', gap: '4px', marginLeft: '24px' },
    tabBtn: (active: boolean) => ({ padding: '6px 12px', fontSize: '12px', border: 'none', background: active ? BLUE_LIGHT : 'transparent', color: active ? BLUE : '#666', borderRadius: '4px', cursor: 'pointer', fontWeight: active ? 600 : 400, fontFamily: '"Arimo", sans-serif' }),
    body: { display: 'flex', flex: 1, minHeight: 0 },
    sidebar: { width: '260px', background: '#FFF', borderRight: '1px solid #EBEBEB', padding: '20px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' },
    sideSection: { padding: '0 14px', marginBottom: '20px' } as React.CSSProperties,
    sideLabel: { fontSize: '10px', fontWeight: 600, color: '#AAA', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' },
    navBtn: (active: boolean) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '6px 8px', borderRadius: '6px', border: 'none', background: active ? '#F3F3F1' : 'transparent', color: active ? '#111' : '#666', cursor: 'pointer', fontSize: '12px', textAlign: 'left', fontFamily: '"Arimo", sans-serif' }),
    main: { flex: 1, display: 'flex', minWidth: 0, background: '#F7F7F6' },
    feed: { flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' },
    viewer: { width: '420px', borderLeft: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    formLabel: { fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' },
    formInput: { width: '100%', padding: '8px 10px', border: '1px solid #E8E8E8', borderRadius: '6px', background: '#F9F9F9', fontSize: '12px', outline: 'none', fontFamily: '"Arimo", sans-serif', boxSizing: 'border-box' } as React.CSSProperties,
    formSelect: { width: '100%', padding: '8px 10px', border: '1px solid #E8E8E8', borderRadius: '6px', background: '#F9F9F9', fontSize: '12px', fontFamily: '"Arimo", sans-serif', boxSizing: 'border-box' } as React.CSSProperties,
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: '#FFF', borderRadius: '8px', padding: '24px', width: '460px', maxHeight: '90vh', overflowY: 'auto' },
    tag: (color?: string) => ({ background: color ? `${color}18` : BLUE_LIGHT, color: color || BLUE_TEXT, padding: '2px 7px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', display: 'inline-block', margin: '2px' }),
    iconBtn: (color?: string) => ({ background: 'none', border: 'none', cursor: 'pointer', color: color || '#888', padding: '4px', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }),
    filterBar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const, background: '#FFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #EBEBEB' },
    briefingPaper: { background: '#FFF', border: '1px solid #D1D5DB', padding: '50px', borderRadius: '4px', width: '100%', maxWidth: '850px', margin: '0 auto', boxSizing: 'border-box', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  } const s = {
  shell: { display: 'flex', flexDirection: 'column' },
  // all your other styles...
  iconBtn: (color?: string) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: color || '#888',
  }),
} satisfies Record<string, React.CSSProperties | ((arg: any) => React.CSSProperties)>;

  function SortToggle({ col, label }: { col: typeof vaultSortBy; label: string; }) {
    return (
      <button
        style={{ background: vaultSortBy === col ? BLUE_LIGHT : 'none', color: vaultSortBy === col ? BLUE : '#666', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', fontFamily: 'inherit' }}
        onClick={() => { if (vaultSortBy === col) setVaultSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setVaultSortBy(col); setVaultSortDir('desc'); } } }
      >
        {label}{vaultSortBy === col ? (vaultSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    );
  }

  const PriorityBadge = ({ p }: { p: string }) => (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', color: '#FFF', background: PRIORITY_COLORS[p] || GRAY }}>{p}</span>
  );

  return (
    <div style={s.shell as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, #root { background: #FFF !important; color: #000 !important; width: 100%; }
          header, .no-print, form, button, select, hr { display: none !important; }
          #printable-briefing-sheet, .printable-incident-report {
            border: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; margin: 0 !important;
          }
          .page-break { page-break-before: always; }
          .incident-card { page-break-inside: avoid; border: 1px solid #333 !important; margin-bottom: 20px !important; }
        }
        input[type="checkbox"] { accent-color: ${BLUE}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #DDD; border-radius: 4px; }
      `}} />

      {/* ── COLLECTION MODAL ── */}
      {showNewCollection && (
        <div style={s.modalOverlay as React.CSSProperties} onClick={(e) => { if (e.target === e.currentTarget) { setShowNewCollection(false); setEditingCollection(null); } }}>
          <form style={s.modalContent as React.CSSProperties} onSubmit={handleSaveCollection}>
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '16px', color: BLUE }}>
              {editingCollection ? 'Edit Scope Collection' : 'Instantiate New Scope Collection'}
            </span>
            <div style={{ marginBottom: '12px' }}><label style={s.formLabel as React.CSSProperties}>Collection Name</label><input style={s.formInput} required value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="e.g. King County Forensics" /></div>
            <div style={{ marginBottom: '12px' }}><label style={s.formLabel as React.CSSProperties}>System Code Signature</label><input style={s.formInput} maxLength={8} required placeholder="e.g. SEA-V2K" value={newColCode} onChange={e => setNewColCode(e.target.value)} /></div>
            <div style={{ marginBottom: '12px' }}><label style={s.formLabel as React.CSSProperties}>Description</label><input style={s.formInput} value={newColDescription} onChange={e => setNewColDescription(e.target.value)} placeholder="Brief scope description" /></div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.formLabel as React.CSSProperties}>Collection Color</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {COLLECTION_PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setNewColColor(c)}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: newColColor === c ? '3px solid #111' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" style={{ padding: '8px 14px', border: '1px solid #E8E8E8', borderRadius: '6px', cursor: 'pointer', background: '#FFF', fontSize: '12px' }} onClick={() => { setShowNewCollection(false); setEditingCollection(null); }}>Cancel</button>
              <button type="submit" style={{ background: BLUE, color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>{editingCollection ? 'Save Changes' : 'Commit Collection'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={s.topbar as React.CSSProperties}>
        <div style={s.logoGroup as React.CSSProperties}>
          <button style={s.logoAnchor as React.CSSProperties} onClick={() => { setActiveTab('vault'); setSelectedCollectionFilter('ALL'); setActiveDoc(null); }}>
            <img src="/Central Trust Securities Logo.png" alt="CTS Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={s.logoText as React.CSSProperties}>Central Trust Securities</span>
          </button>
          <div style={s.tabGroup}>
            {(['vault', 'incidents', 'briefings', 'cases', 'audit'] as const).map(tab => (
              <button key={tab} style={(s.tabBtn as Function)(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {tab === 'vault' ? 'Document Vault' : tab === 'incidents' ? 'SACS Incident Logger' : tab === 'briefings' ? 'Intelligence Matrix' : tab === 'cases' ? 'Case Studies' : 'Audit Trail'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#888' }}>
          <span>Docs: <strong style={{ color: '#111' }}>{documentsVault.filter(d => !d.isArchived).length}</strong></span>
          <span>·</span>
          <span>Incidents: <strong style={{ color: '#111' }}>{incidents.filter(i => !i.isArchived).length}</strong></span>
          <span>·</span>
          <span>Briefings: <strong style={{ color: '#111' }}>{briefingsArchive.filter(b => !b.isArchived).length}</strong></span>
        </div>
      </header>

      <div style={s.body as React.CSSProperties}>

       {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: DOCUMENT VAULT                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'vault' && (
          <>
            <aside style={s.sidebar as React.CSSProperties}>
              <div style={s.sideSection as React.CSSProperties}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={s.sideLabel as React.CSSProperties}>Scope Collections</span>
                  <button style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }} onClick={() => { setEditingCollection(null); setNewColName(''); setNewColCode(''); setNewColColor(COLLECTION_PALETTE[0]); setNewColDescription(''); setShowNewCollection(true); }}>+</button>
                </div>

                <button style={(s.navBtn as Function)(selectedCollectionFilter === 'ALL')} onClick={() => setSelectedCollectionFilter('ALL')}>
                  <span>🗂 Global Ledger</span><span style={{ fontSize: '10px', background: '#F0F0F0', padding: '1px 5px', borderRadius: '3px' }}>{documentsVault.filter(d => !d.isArchived).length}</span>
                </button>
                <button style={(s.navBtn as Function)(selectedCollectionFilter === 'CENTRAL')} onClick={() => setSelectedCollectionFilter('CENTRAL')}>
                  <span>📁 Central (Unassigned)</span><span style={{ fontSize: '10px' }}>{documentsVault.filter(d => !d.collectionId && !d.isArchived).length}</span>
                </button>

                {collections.map(col => (
                  <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button style={{ ...(s.navBtn as Function)(selectedCollectionFilter === col.id), flex: 1 }} onClick={() => setSelectedCollectionFilter(col.id)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
                      </span>
                      <span style={{ fontSize: '10px', flexShrink: 0 }}>{documentsVault.filter(d => d.collectionId === col.id && !d.isArchived).length}</span>
                    </button>
                    <button style={(s.iconBtn as Function)('#AAA')} title={`Edit ${col.name}`} onClick={() => openEditCollection(col)}>✎</button>
                    <button style={(s.iconBtn as Function)('#CC3333')} title={`Delete ${col.name}`} onClick={() => deleteCollection(col.id)}>✕</button>
                  </div>
                ))}

                <hr style={{ border: 'none', borderTop: '1px solid #EBEBEB', margin: '12px 0' }} />

                <span style={s.sideLabel as React.CSSProperties}>Quick Filters</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showFlaggedOnly} onChange={e => setShowFlaggedOnly(e.target.checked)} />
                  🚩 Flagged Only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', marginBottom: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showArchivedDocs} onChange={e => setShowArchivedDocs(e.target.checked)} />
                  📦 Show Archived
                </label>

                {allVaultTags.length > 0 && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid #EBEBEB', margin: '12px 0' }} />
                    <span style={s.sideLabel as React.CSSProperties}>Tag Filter</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                     {allVaultTags.map((tag, i) => (
  <button key={`${tag}-${i}`} onClick={() => setVaultTagFilter(tag)} 
          style={{ /* your existing styles */ }}>
    {tag}
  </button>
))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ ...s.sideSection, marginTop: 'auto', borderTop: '1px solid #EBEBEB', paddingTop: '16px' } as React.CSSProperties}>
                <span style={s.sideLabel as React.CSSProperties}>Systemic Design Integrity</span>
                <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Shield:</strong> Perimeter Defense & Fiduciary Custody Enclosure.</p>
                  <p style={{ margin: '0 0 6px 0' }}><strong>∮F·dr = 0:</strong> Closed-Loop Zero-Trust Boundary Auditing.</p>
                  <p style={{ margin: 0 }}><strong>Central Axes:</strong> Multi-Context Vector Authentication.</p>
                </div>
              </div>
            </aside>

            <div style={s.main as React.CSSProperties}>
              <div style={s.feed as React.CSSProperties}>

                <div style={{ background: '#FFF', border: `1px solid ${BLUE}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secure Manifest Intake — SHA-256 Anchoring</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ background: '#111', color: '#FFF', border: 'none', borderRadius: '4px', padding: '5px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }} onClick={exportVaultIndex}>⬇ Export Vault Index</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={s.formLabel as React.CSSProperties}>Target Collection</label>
                      <select style={s.formSelect} value={uploadCollectionTarget} onChange={e => setUploadCollectionTarget(e.target.value)}>
                        <option value="CENTRAL">Central Repository</option>
                        {collections.map(c => <option key={c.id} value={c.id}>{c.name} [{c.code}]</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.formLabel as React.CSSProperties}>Document Type</label>
                      <select style={s.formSelect} value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}>
                        {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.formLabel as React.CSSProperties}>Priority Level</label>
                      <select style={s.formSelect} value={uploadPriority} onChange={e => setUploadPriority(e.target.value as LedgerDocument['priority'])}>
                        <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={s.formLabel as React.CSSProperties}>Tags (comma-separated)</label>
                      <input style={s.formInput} placeholder="FORENSIC, EXHIBIT-A, KING-COUNTY" value={uploadTags} onChange={e => setUploadTags(e.target.value)} />
                    </div>
                    <div>
                      <label style={s.formLabel as React.CSSProperties}>Description / Notes</label>
                      <input style={s.formInput} placeholder="Optional description or provenance note" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="file" ref={fileInputRef} onChange={handleVaultUpload} style={{ display: 'none' }} />
<input type="file" ref={batchFileInputRef} onChange={handleVaultUpload} multiple style={{ display: 'none' }} />

<button style={{ background: BLUE, color: '#FFF', padding: '8px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', flex: 1 }} onClick={() => fileInputRef.current?.click()}>
  {isHashing ? '⏳ Hashing...' : '⬆ Upload & Anchor Document'}
</button>
                    <button style={{ background: '#F3F4F6', color: '#333', padding: '8px 18px', border: '1px solid #E8E8E8', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }} onClick={() => batchFileInputRef.current?.click()}>
                      📂 Batch Upload
                    </button>
                  </div>
                </div>

                <div style={s.filterBar as React.CSSProperties} className="no-print">
                  <input style={{ ...s.formInput, width: '180px' }} placeholder="🔍 Search vault..." value={vaultSearch} onChange={e => setVaultSearch(e.target.value)} />
                  <select style={{ ...s.formSelect, width: '140px' }} value={vaultDocTypeFilter} onChange={e => setVaultDocTypeFilter(e.target.value)}>
                    <option value="ALL">All Doc Types</option>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select style={{ ...s.formSelect, width: '140px' }} value={vaultPriorityFilter} onChange={e => setVaultPriorityFilter(e.target.value)}>
                    <option value="ALL">All Priorities</option>
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNCLASSIFIED'].map(p => <option key={p}>{p}</option>)}
                  </select>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>Sort:</span>
                    <SortToggle col="date" label="Date" />
                    <SortToggle col="name" label="Name" />
                    <SortToggle col="priority" label="Priority" />
                    <SortToggle col="type" label="Type" />
                  </div>
                </div>

                {filteredAndSortedDocs.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px' }} className="no-print">
                    <input type="checkbox" checked={selectedDocIds.length === filteredAndSortedDocs.length && filteredAndSortedDocs.length > 0} onChange={e => e.target.checked ? selectAllFiltered() : clearSelection()} />
                    <span style={{ color: '#666' }}>{selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'Select all'}</span>
                    {selectedDocIds.length > 0 && (
                      <>
                        <span style={{ color: '#DDD' }}>|</span>
                        <span style={{ color: '#888' }}>Move to:</span>
                        <select style={{ ...s.formSelect, width: '160px', padding: '3px 6px' }} value={bulkTargetCollection} onChange={e => setBulkTargetCollection(e.target.value)}>
                          <option value="CENTRAL">Central Repository</option>
                          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={bulkReallocate} style={{ background: BLUE, color: '#FFF', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Move</button>
                        <button onClick={bulkFlag} style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>🚩 Flag</button>
                        <button onClick={bulkArchive} style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E8E8E8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>📦 Archive</button>
                        <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>✕ Clear</button>
                      </>
                    )}
                    <span style={{ marginLeft: 'auto', color: '#AAA' }}>{filteredAndSortedDocs.length} records</span>
                  </div>
                )}

                {filteredAndSortedDocs.map(doc => (
                  <div key={doc.id}
                    style={{ background: doc.isArchived ? '#F9F9F9' : '#FFF', border: doc.id === activeDoc?.id ? `2px solid ${BLUE}` : selectedDocIds.includes(doc.id) ? `2px solid #7c3aed` : '1px solid #EBEBEB', borderRadius: '8px', padding: '14px', cursor: 'pointer', opacity: doc.isArchived ? 0.7 : 1 }}
                    onClick={() => { setActiveDoc(doc); setEditingDocId(null); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={e => { e.stopPropagation(); toggleBulkSelect(doc.id); }} onClick={e => e.stopPropagation()} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{doc.isFlagged ? '🚩 ' : ''}{doc.name}</span>
                            {doc.isArchived && <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#888', padding: '1px 5px', borderRadius: '3px' }}>ARCHIVED</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                            {doc.description && <span>{doc.description} · </span>}
                            Added {doc.dateAdded}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                        <PriorityBadge p={doc.priority} />
                        <span style={{ fontSize: '10px', background: '#F0F3F6', padding: '2px 6px', borderRadius: '4px', color: '#555' }}>{doc.docType}</span>
                        {(() => { const col = collections.find(c => c.id === doc.collectionId); return col ? <span style={{ fontSize: '10px', background: `${col.color}18`, color: col.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{col.code}</span> : <span style={{ fontSize: '10px', background: '#F0F3F6', padding: '2px 6px', borderRadius: '4px' }}>CENTRAL</span>; })()}
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '11px', color: '#888' }}>
                      <span><strong>ID:</strong> {doc.id}</span>
                     <span><strong>SHA-256:</strong> 
  <span style={{ fontFamily: 'monospace' }}>
    {doc.hash ? doc.hash.substring(0, 20) : 'Calculating...'}...
  </span>
</span>
</div>

{/* 💡 Added optional chaining (?.) and fallback empty array ([]) to prevent crashes */}
{(doc.tags?.length ?? 0) > 0 && (
  <div style={{ marginTop: '6px' }}>
    {doc.tags?.map(t => (
      <span key={t} style={{ /* your styles */ }}>{t}</span>
    ))}
  </div>
)}
                  </div>
                ))}

                {filteredAndSortedDocs.length === 0 && (
                  <div style={{ background: '#FFF', border: '1px solid #EBEBEB', padding: '40px', textAlign: 'center', color: '#AAA', borderRadius: '8px' }}>
                    No documents match the current filter criteria. Upload a document or adjust filters.
                  </div>
                )}
              </div>

              <div style={s.viewer as React.CSSProperties}>
                {activeDoc ? (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: BLUE_TEXT, textTransform: 'uppercase' }}>Provenance Verification</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button title={activeDoc.isFlagged ? 'Remove Flag' : 'Flag for Review'} style={(s.iconBtn as Function)(activeDoc.isFlagged ? ORANGE : '#888')} onClick={() => toggleDocFlag(activeDoc.id)}>🚩</button>
                        <button title={activeDoc.isArchived ? 'Restore from Archive' : 'Archive Document'} style={(s.iconBtn as Function)('#888')} onClick={() => toggleDocArchive(activeDoc.id)}>📦</button>
                        <button title="Delete Document" style={(s.iconBtn as Function)(RED)} onClick={() => deleteDoc(activeDoc.id)}>🗑</button>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{activeDoc.name}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>Added {activeDoc.dateAdded} · {activeDoc.docType}</div>

                    <div style={{ background: '#F3F4F6', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #E5E7EB' }}>
                      <label style={{ ...s.formLabel, color: BLUE_TEXT } as React.CSSProperties}>Reallocate to Collection</label>
                      <select style={{ ...s.formSelect, marginTop: '4px', background: '#FFF' }} value={activeDoc.collectionId || 'CENTRAL'} onChange={e => reallocateDocCollection(activeDoc.id, e.target.value)}>
                        <option value="CENTRAL">Central Ledger (Unassigned)</option>
                        {collections.map(c => <option key={c.id} value={c.id}>{c.name} [{c.code}]</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ background: '#FAFAFA', padding: '8px', borderRadius: '6px', fontSize: '11px' }}>
                        <div style={{ color: '#888', marginBottom: '3px' }}>PRIORITY</div>
                        <PriorityBadge p={activeDoc.priority} />
                      </div>
                      <div style={{ background: '#FAFAFA', padding: '8px', borderRadius: '6px', fontSize: '11px' }}>
                        <div style={{ color: '#888', marginBottom: '3px' }}>DOC TYPE</div>
                        <span style={{ fontWeight: 600 }}>{activeDoc.docType}</span>
                      </div>
                    </div>

         {/* 💡 Safely check for activeDoc before rendering the edit/view toggle */}
{editingDocId === activeDoc.id ? (
    <div style={{ background: '#F0F7FF', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: `1px solid ${BLUE_LIGHT}` }}>
      <label style={s.formLabel as React.CSSProperties}>Tags (comma-separated)</label>
      <input style={{ ...s.formInput, marginBottom: '8px' }} value={editDocTags} onChange={e => setEditDocTags(e.target.value)} />
      <label style={s.formLabel as React.CSSProperties}>Description</label>
      <input style={{ ...s.formInput, marginBottom: '8px' }} value={editDocDescription} onChange={e => setEditDocDescription(e.target.value)} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => saveDocEdits(activeDoc.id)} style={{ background: BLUE, color: '#FFF', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Save</button>
        <button onClick={() => setEditingDocId(null)} style={{ background: '#FFF', border: '1px solid #E8E8E8', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
      </div>
    </div>
  ) : (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={s.formLabel as React.CSSProperties}>Tags & Metadata</span>
        {/* 💡 Safely handle access to tags and description inside the edit trigger */}
        <button style={(s.iconBtn as Function)(BLUE)} onClick={() => { 
          setEditingDocId(activeDoc.id); 
          setEditDocTags(activeDoc.tags?.join(', ') ?? ''); 
          setEditDocDescription(activeDoc.description ?? ''); 
        }}>✎ Edit</button>
      </div>
      {activeDoc.description && <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>{activeDoc.description}</div>}
      
      {/* Safe tags rendering */}
      <div>
        {(activeDoc?.tags?.length ?? 0) > 0 
          ? activeDoc.tags.map((t, i) => (
              <span key={`${t}-${i}`} style={(s.tag as Function)()}>{t}</span>
            )) 
          : <span style={{ fontSize: '11px', color: '#CCC' }}>No tags assigned</span>
        }
      </div>

      <div style={{ flex: 1, background: '#FAFAFA', borderRadius: '4px', border: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: '200px' }}>
        <iframe src={activeDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title="Document viewer" sandbox="allow-same-origin" />
      </div>

      <div style={{ background: '#F3F4F6', padding: '8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '10px' }}>
        <strong>INTEGRITY STAMP:</strong> {activeDoc.hash}
      </div>
    </div>
  )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#AAA', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
                    Select an archive record to review properties, reassign collections, or edit metadata
                  </div>
                )}
              </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: SACS INCIDENT LOGGER                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
            </div>
          </>
        )}

        {activeTab === 'incidents' && (
          <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', overflowY: 'auto' }}>
            <form onSubmit={handleLogIncident} className="no-print" style={{ width: '380px', background: '#FFF', padding: '20px', borderRadius: '8px', border: '1px solid #EBEBEB', flexShrink: 0, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: BLUE }}>Instantiate SACS Entry</span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Macro System</label>
                  <select style={s.formSelect} value={sacsSystem} onChange={e => setSacsSystem(e.target.value)}><option value="JUD">JUD (Judicial)</option><option value="EXE">EXE (Executive)</option><option value="LEG">LEG (Legislative)</option><option value="MIL">MIL (Military)</option></select>
                </div>
                <div><label style={s.formLabel as React.CSSProperties}>Domain Class</label>
                  <select style={s.formSelect} value={sacsDomain} onChange={e => setSacsDomain(e.target.value)}><option value="POL">POL (Tactical)</option><option value="CRT">CRT (Courts)</option><option value="FSC">FSC (Fiscal)</option><option value="SIG">SIG (Signals)</option></select>
                </div>
              </div>

              {/* ADDED TAXONOMY MATRIX LAYERS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Role Directive</label>
                  <select style={s.formSelect} value={sacsRole} onChange={e => setSacsRole(e.target.value)}><option value="INI">INI (Initialization)</option><option value="VAL">VAL (Validation)</option><option value="SUP">SUP (Supervisory)</option></select>
                </div>
                <div><label style={s.formLabel as React.CSSProperties}>Functional Layer</label>
                  <select style={s.formSelect} value={sacsFunction} onChange={e => setSacsFunction(e.target.value)}><option value="INV">INV (Investigation)</option><option value="REP">REP (Reporting)</option><option value="AUD">AUD (Audit)</option></select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Risk Tier</label>
                  <select style={s.formSelect} value={sacsRisk} onChange={e => setSacsRisk(e.target.value)}><option value="C">C (Critical)</option><option value="M">M (Major)</option><option value="L">L (Minor)</option></select>
                </div>
                <div><label style={s.formLabel as React.CSSProperties}>Failure Mode</label>
                  <select style={s.formSelect} value={sacsFailure} onChange={e => setSacsFailure(e.target.value)}><option value="AU">AU (Authority Breach)</option><option value="DA">DA (Data Mutation)</option><option value="EX">EX (Compromise)</option></select>
                </div>
              </div>

              {/* DYNAMIC CODE PREVIEW ENGINE */}
              <div style={{ background: '#F0F7FF', borderRadius: '6px', padding: '8px', fontSize: '11px', fontFamily: 'monospace', color: BLUE_TEXT, border: `1px solid ${BLUE_LIGHT}` }}>
                Generated Code: <strong>{sacsSystem}.{sacsDomain}.{sacsRole}.{sacsFunction}.{sacsRisk}.{sacsFailure}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Priority Rank</label>
                  <select style={s.formSelect} value={incPriority} onChange={e => setIncPriority(e.target.value as any)}>
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={s.formLabel as React.CSSProperties}>Clearance Tier</label>
                  <select style={s.formSelect} value={clearanceTier} onChange={e => setClearanceTier(e.target.value)}>
                    <option value="TIER-3">TIER-3 (Secret)</option><option value="TIER-4">TIER-4 (Top Secret)</option><option value="TIER-5">TIER-5 (SCI)</option>
                  </select>
                </div>
              </div>

              <div><label style={s.formLabel as React.CSSProperties}>Target Node Reference</label><input style={s.formInput} value={targetSubject} onChange={e => setTargetSubject(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Scope Flags</label><input style={s.formInput} value={scopeFlags} onChange={e => setScopeFlags(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>X-Axis (Temporal / Location)</label><input style={s.formInput} value={xAxis} onChange={e => setXAxis(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Y-Axis (Institutional / Geographic)</label><input style={s.formInput} value={yAxis} onChange={e => setYAxis(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Z-Axis (Governance Classification)</label><input style={s.formInput} value={zAxis} onChange={e => setZAxis(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Sensory Narrative Log</label><input style={s.formInput} value={sensoryInput} onChange={e => setSensoryInput(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Signal / Perceptual Phenomenon</label><input style={s.formInput} value={perceptualPhenomenon} onChange={e => setPerceptualPhenomenon(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Tags (comma-separated)</label><input style={s.formInput} placeholder="SEATTLE, DIGITAL-BIO, V2K" value={incidentTags} onChange={e => setIncidentTags(e.target.value)} /></div>

              <div>
                <label style={s.formLabel as React.CSSProperties}>Anchor Evidentiary Vault Logs</label>
                <div style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '6px', background: '#F9F9F9' }}>
                  {documentsVault.filter(d => !d.isArchived).map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                      <input type="checkbox" checked={incidentDocAttachments.includes(d.id)} onChange={() => toggleIncidentAttachment(d.id)} />
                      <span>{d.name}</span>
                    </label>
                  ))}
                  {documentsVault.filter(d => !d.isArchived).length === 0 && <span style={{ fontSize: '11px', color: '#AAA' }}>No vault documents available</span>}
                </div>
              </div>

              <button type="submit" style={{ padding: '10px', background: BLUE, color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Commit Entry to SACS Ledger</button>
            </form>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={s.filterBar as React.CSSProperties} className="no-print">
                <input style={{ ...s.formInput, width: '200px' }} placeholder="🔍 Search incidents..." value={incidentSearch} onChange={e => setIncidentSearch(e.target.value)} />
                <select style={{ ...s.formSelect, width: '130px' }} value={incidentPriorityFilter} onChange={e => setIncidentPriorityFilter(e.target.value)}>
                  <option value="ALL">All Priorities</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p}>{p}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showArchivedIncidents} onChange={e => setShowArchivedIncidents(e.target.checked)} /> Show Archived
                </label>
                <button onClick={triggerPrintProtocol} style={{ marginLeft: 'auto', padding: '6px 14px', background: '#111', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>🖨 Print Log</button>
              </div>

              <div className="printable-incident-report" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredIncidents.map(inc => (
                  <div key={inc.id} className="incident-card" style={{ background: inc.isArchived ? '#F9F9F9' : '#FFF', padding: '16px', borderRadius: '8px', border: '1px solid #EBEBEB', opacity: inc.isArchived ? 0.75 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: BLUE_TEXT, background: BLUE_LIGHT, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{inc.sacsCode}</span>
                        <PriorityBadge p={inc.priority} />
                        <span style={{ fontSize: '10px', color: '#888', background: '#F3F4F6', padding: '2px 5px', borderRadius: '3px' }}>{inc.clearanceTier}</span>
                        {inc.isArchived && <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#888', padding: '2px 5px', borderRadius: '3px' }}>ARCHIVED</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>{inc.timestamp}</span>
                        <button style={(s.iconBtn as Function)('#888')} className="no-print" onClick={() => toggleIncidentArchive(inc.id)} title={inc.isArchived ? 'Restore' : 'Archive'}>📦</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '170px 1fr', gap: '4px' }}>
                      <strong>Target Subject:</strong><span>{inc.targetSubject || 'N/A'}</span>
                      <strong>X-Axis Coordinates:</strong><span>{inc.xAxis || 'N/A'}</span>
                      <strong>Y-Axis Correlation:</strong><span>{inc.yAxis || 'N/A'}</span>
                      <strong>Scope Flags:</strong><span>{inc.scopeFlags || 'N/A'}</span>
                      <strong>Sensory Data:</strong><span>{inc.sensoryInput || 'N/A'}</span>
                      <strong>Signal / Perceptual:</strong><span>{inc.perceptualPhenomenon || 'N/A'}</span>
                    </div>
                    {inc.tags.length > 0 && <div style={{ marginTop: '6px' }}>{inc.tags.map(t => <span key={t} style={(s.tag as Function)()}>{t}</span>)}</div>}
                    {inc.attachedDocIds?.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #EBEBEB' }}>
                        <span style={{ fontSize: '10px', color: '#888', fontWeight: 600 }}>LINKED VAULT SIGNATURES: </span>
                        {inc.attachedDocIds.map(dId => (
                          <span key={dId} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', marginLeft: '4px' }}>
                            {documentsVault.find(doc => doc.id === dId)?.name || dId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {filteredIncidents.length === 0 && (
                  <div style={{ background: '#FFF', border: '1px solid #EBEBEB', padding: '30px', textAlign: 'center', color: '#999', borderRadius: '8px' }}>No tracked incidents matching the specified filters.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: INTELLIGENCE BRIEFING MATRIX                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'briefings' && (
          <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', overflowY: 'auto' }}>
            <form onSubmit={handleCommitBriefing} className="no-print" style={{ width: '380px', background: '#FFF', padding: '20px', borderRadius: '8px', border: '1px solid #EBEBEB', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: BLUE }}>Compile Intelligence Briefing Vector</span>

              <div><label style={s.formLabel as React.CSSProperties}>Brief Title / Operation Name</label><input style={s.formInput} value={briefTitle} onChange={e => setBriefTitle(e.target.value)} placeholder="Operation Designation" /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Priority</label>
                  <select style={s.formSelect} value={briefPriority} onChange={e => setBriefPriority(e.target.value as any)}>
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={s.formLabel as React.CSSProperties}>Classification</label>
                  <select style={s.formSelect} value={briefClassification} onChange={e => setBriefClassification(e.target.value)}>
                    <option>SECRET // EYES ONLY</option>
                    <option>TOP SECRET // SCI</option>
                    <option>CONFIDENTIAL</option>
                    <option>UNCLASSIFIED // FOUO</option>
                  </select>
                </div>
              </div>

              <div><label style={s.formLabel as React.CSSProperties}>Analyst Cell</label><input style={s.formInput} value={briefAnalyst || briefAnalyst} onChange={e => setBriefAnalyst(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Intel Cycle</label><input style={s.formInput} value={briefCycle} onChange={e => setBriefCycle(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Nut Graf (Executive Summary)</label><textarea style={{ ...s.formInput, height: '55px', resize: 'none' } as React.CSSProperties} value={briefNutGraf} onChange={e => setBriefNutGraf(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Key Judgments (one per line)</label><textarea style={{ ...s.formInput, height: '55px', resize: 'none' } as React.CSSProperties} value={briefKeyJudgments} onChange={e => setBriefKeyJudgments(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Headline Vector</label><input style={s.formInput} value={briefHeadline} onChange={e => setBriefHeadline(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Core Fact / Evidence Anchor</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={briefFact} onChange={e => setBriefFact(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Implications Trace</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={briefImplications} onChange={e => setBriefImplications(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Alternative Perspectives</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={briefAlternatives} onChange={e => setBriefAlternatives(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Horizon Scanning / Early Warnings</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={briefHorizon} onChange={e => setBriefHorizon(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Action Items & Directives</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={briefActionItems} onChange={e => setBriefActionItems(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Tags (comma-separated)</label><input style={s.formInput} placeholder="SIGNALS, JUDICIAL, EXHIBIT" value={briefTags} onChange={e => setBriefTags(e.target.value)} /></div>
              <div>
                <label style={s.formLabel as React.CSSProperties}>Grounding Source Document</label>
                <select style={s.formSelect} value={briefSourceDocId} onChange={e => setBriefSourceDocId(e.target.value)}>
                  <option value="">— No source document —</option>
                  {documentsVault.filter(d => !d.isArchived).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button type="submit" style={{ padding: '10px', background: BLUE, color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Commit Briefing to Archive</button>
            </form>

            <div style={{ flex: 1, display: 'flex', gap: '20px', minWidth: 0 }}>
              {/* Archive list */}
              <div className="no-print" style={{ width: '260px', background: '#FFF', borderRadius: '8px', border: '1px solid #EBEBEB', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#AAA', marginBottom: '4px' }}>BRIEFING ARCHIVE</span>
                <input style={{ ...s.formInput, marginBottom: '6px' }} placeholder="🔍 Search..." value={briefingSearch} onChange={e => setBriefingSearch(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666', cursor: 'pointer', marginBottom: '6px' }}>
                  <input type="checkbox" checked={showArchivedBriefings} onChange={e => setShowArchivedBriefings(e.target.checked)} /> Show Archived
                </label>
                {filteredBriefings.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button style={{ ...(s.navBtn as Function)(activeBrief?.id === b.id), flex: 1, textAlign: 'left' }} onClick={() => setActiveBrief(b)}>
                      <div>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{b.title}</div>
                        <div style={{ fontSize: '10px', color: '#999' }}><PriorityBadge p={b.priority} /></div>
                      </div>
                    </button>
                    <button style={(s.iconBtn as Function)('#888')} onClick={() => toggleBriefingArchive(b.id)} title={b.isArchived ? 'Restore' : 'Archive'}>📦</button>
                  </div>
                ))}
                {filteredBriefings.length === 0 && <span style={{ fontSize: '11px', color: '#CCC' }}>No briefings on record</span>}
              </div>

              {/* Briefing paper stack column */}
              <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                <div id="printable-briefing-sheet" style={s.briefingPaper as React.CSSProperties}>
                  <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* RESTORED LOGO GRAPHIC DIRECTLY TO BRIEF SHEET HEADER */}
                        <img src="/Central Trust Securities Logo.png" alt="CTS Logo" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Central Trust Securities — Intelligence Brief</div>
                          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0', color: '#111' }}>{activeBrief ? activeBrief.title : briefTitle || 'Draft Briefing'}</h1>
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                            CYCLE: {activeBrief ? activeBrief.cycle : briefCycle} · ANALYST: {activeBrief ? activeBrief.analyst : briefAnalyst}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF', background: RED, padding: '3px 10px', borderRadius: '3px', letterSpacing: '0.08em' }}>{activeBrief ? activeBrief.classification : briefClassification}</span>
                        {activeBrief && <PriorityBadge p={activeBrief.priority} />}
                        {activeBrief && activeBrief.tags.length > 0 && <div>{activeBrief.tags.map(t => <span key={t} style={(s.tag as Function)()}>{t}</span>)}</div>}
                      </div>
                    </div>
                  </div>

                  {[
  { title: '1. The Nut Graf — Executive Summary', content: activeBrief ? activeBrief.nutGraf : briefNutGraf },
  { title: '2. Key Judgments', content: activeBrief ? activeBrief.keyJudgments : briefKeyJudgments, monospace: true },
  { title: '3. Headline Vector', content: activeBrief ? activeBrief.headline : briefHeadline },
  { title: '4. Core Evidence / Fact Anchor', content: activeBrief ? activeBrief.fact : briefFact },
  { title: '5. Implications Trace', content: activeBrief ? activeBrief.implications : briefImplications },
  { title: '6. Alternative Perspectives', content: activeBrief ? activeBrief.alternatives : briefAlternatives },
  { title: '7. Horizon Scanning / Early Warnings', content: activeBrief ? activeBrief.horizon : briefHorizon },
  { title: '8. Action Items & Directives', content: activeBrief ? activeBrief.actionItems : briefActionItems, monospace: true },
].map(({ title, content, monospace }) => (
  <div key={title} style={{ marginBottom: '20px' }}>
    <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: BLUE, margin: '0 0 6px 0', borderBottom: `1px solid ${BLUE_LIGHT}`, paddingBottom: '3px' }}>{title}</h2>
    <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#222', whiteSpace: 'pre-wrap', ...(monospace ? { fontFamily: 'monospace', background: '#F8FAFC', padding: '10px', borderRadius: '4px', borderLeft: `3px solid ${BLUE}` } : {}) }}>
      {content || <span style={{ color: '#CCC' }}>[Not populated]</span>}
    </div>
  </div>
))}

                  {(activeBrief?.sourceDocId || briefSourceDocId) && (
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: BLUE_TEXT }}>
                      GROUNDING RECORD ANCHOR: {documentsVault.find(x => x.id === (activeBrief ? activeBrief.sourceDocId : briefSourceDocId))?.name}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }} className="no-print">
                  <button onClick={triggerPrintProtocol} style={{ padding: '8px 20px', background: '#111', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>🖨 Execute Print Formatter</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: CASE STUDIES BUILDER                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'cases' && (
          <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', overflowY: 'auto' }}>
            <form onSubmit={handleCreateCaseStudy} className="no-print" style={{ width: '380px', background: '#FFF', padding: '20px', borderRadius: '8px', border: '1px solid #EBEBEB', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: BLUE }}>Compile Institutional Case File</span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Case/File No.</label><input style={s.formInput} placeholder="658931" value={csNumber} onChange={e => setCsNumber(e.target.value)} /></div>
                <div><label style={s.formLabel as React.CSSProperties}>Arbitrating Judge</label><input style={s.formInput} value={csJudge} onChange={e => setCsJudge(e.target.value)} /></div>
              </div>

              <div><label style={s.formLabel as React.CSSProperties}>Cause / Litigation Subject</label><input style={s.formInput} value={csCause} onChange={e => setCsCause(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Parties of Record</label><input style={s.formInput} value={csParties} onChange={e => setCsParties(e.target.value)} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={s.formLabel as React.CSSProperties}>Incarceration Window</label><input style={s.formInput} value={csIncarceration} onChange={e => setCsIncarceration(e.target.value)} /></div>
                <div><label style={s.formLabel as React.CSSProperties}>Disposition / Status</label><input style={s.formInput} value={csDisposition} onChange={e => setCsDisposition(e.target.value)} /></div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #EBEBEB', margin: '2px 0' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888' }}>SYSTEMIC STRATIGRAPHIC CRITERIA</span>

              <div><label style={s.formLabel as React.CSSProperties}>Institutional Compression Factors</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={csCompression} onChange={e => setCsCompression(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Evidentiary Gaps (Non-Inscription)</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={csMemoryGaps} onChange={e => setCsMemoryGaps(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Technological Variables</label><textarea style={{ ...s.formInput, height: '45px', resize: 'none' } as React.CSSProperties} value={csVariables} onChange={e => setCsVariables(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Core Analysis Narrative</label><textarea style={{ ...s.formInput, height: '60px', resize: 'none' } as React.CSSProperties} value={csAnalysis} onChange={e => setCsAnalysis(e.target.value)} /></div>
              <div><label style={s.formLabel as React.CSSProperties}>Tags (comma-separated)</label><input style={s.formInput} placeholder="SEATTLE, KING-COUNTY, CRIMINAL" value={csTags} onChange={e => setCsTags(e.target.value)} /></div>

              <div>
                <label style={s.formLabel as React.CSSProperties}>Anchor Evidentiary Vault Logs</label>
                <div style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '6px', background: '#F9F9F9' }}>
                  {documentsVault.filter(d => !d.isArchived).map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                      <input type="checkbox" checked={csDocAttachments.includes(d.id)} onChange={() => toggleCaseAttachment(d.id)} />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" style={{ padding: '10px', background: BLUE, color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Commit Case File to Ledger</button>
            </form>

            <div style={{ flex: 1, display: 'flex', gap: '20px' }}>
              <div className="no-print" style={{ width: '240px', background: '#FFF', borderRadius: '8px', border: '1px solid #EBEBEB', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#AAA' }}>ACTIVE ARCHIVE STACKS</span>
                <input style={{ ...s.formInput, marginBottom: '6px' }} placeholder="🔍 Search cases..." value={caseSearch} onChange={e => setCaseSearch(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666', cursor: 'pointer', marginBottom: '6px' }}>
                  <input type="checkbox" checked={showArchivedCases} onChange={e => setShowArchivedCases(e.target.checked)} /> Show Archived
                </label>
                {filteredCases.map(cs => (
                  <div key={cs.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button style={{ ...(s.navBtn as Function)(activeCaseStudy?.id === cs.id), flex: 1 }} onClick={() => setActiveCaseStudy(cs)}>
                      <div>
                        <div style={{ fontWeight: 600 }}>No. {cs.caseNumber}</div>
                        <div style={{ fontSize: '10px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{cs.cause}</div>
                      </div>
                    </button>
                    <button style={(s.iconBtn as Function)('#888')} onClick={() => toggleCaseArchive(cs.id)} title={cs.isArchived ? 'Restore' : 'Archive'}>📦</button>
                  </div>
                ))}
                {filteredCases.length === 0 && <span style={{ fontSize: '11px', color: '#CCC' }}>No case files on record</span>}
              </div>

              <div style={{ flex: 1, background: '#FFF', border: '1px solid #EBEBEB', borderRadius: '8px', padding: '24px', overflowY: 'auto' }}>
                {activeCaseStudy ? (
                  <div>
                    <div style={{ borderBottom: '1px solid #111', paddingBottom: '10px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: BLUE, fontWeight: 700 }}>CASE ANALYSIS</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{activeCaseStudy.timestamp}</span>
                          <button onClick={triggerPrintProtocol} style={{ padding: '4px 10px', background: '#111', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }} className="no-print">🖨 Print</button>
                        </div>
                      </div>
                      <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 600 }}>{activeCaseStudy.parties}</h2>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>File: {activeCaseStudy.caseNumber} · Judge: {activeCaseStudy.judge}</div>
                      {activeCaseStudy.tags.length > 0 && <div style={{ marginTop: '6px' }}>{activeCaseStudy.tags.map(t => <span key={t} style={(s.tag as Function)()}>{t}</span>)}</div>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#FAFAFA', padding: '12px', borderRadius: '6px', border: '1px solid #EBEBEB', fontSize: '12px', marginBottom: '16px' }}>
                      <div><strong>Litigation Cause:</strong> {activeCaseStudy.cause}</div>
                      <div><strong>Disposition Status:</strong> <span style={{ color: BLUE_TEXT, fontWeight: 600 }}>{activeCaseStudy.dispositionStatus}</span></div>
                      <div><strong>Incarceration Window:</strong> {activeCaseStudy.incarcerationDates}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: '1.5' }}>
                      {[
                        { label: 'A. Institutional Compression', value: activeCaseStudy.institutionalCompressionContext },
                        { label: 'B. Non-Inscription Patterns', value: activeCaseStudy.evidentiaryMemoryGaps },
                        { label: 'C. Technological Variables', value: activeCaseStudy.technologicalVariables },
                        { label: 'D. Analytical Annotations', value: activeCaseStudy.proceduralAnalysisMarkdown },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <strong style={{ fontSize: '11px', color: BLUE, textTransform: 'uppercase', display: 'block' }}>{label}</strong>
                          <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{value || <span style={{ color: '#CCC' }}>[Not populated]</span>}</p>
                        </div>
                      ))}

                      {activeCaseStudy.attachedDocIds?.length > 0 && (
                        <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: '12px', marginTop: '8px' }}>
                          <strong style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px' }}>BOUND SYSTEM ARCHIVE ATTACHMENTS</strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {activeCaseStudy.attachedDocIds.map(dId => (
                              <span key={dId} style={{ background: BLUE_LIGHT, color: BLUE_TEXT, padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                {documentsVault.find(doc => doc.id === dId)?.name || dId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#AAA', fontSize: '12px' }}>Select an active stack file to review data entries</div>
                )}
              </div>
            </div>
          </div>
        )}
{/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: AUDIT TRAIL                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>System Audit Trail</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888' }}>
                  Immutable log of all system actions and data operations · {auditLog?.length ?? 0} entries
                </p>
              </div>
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(auditLog, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `CTS_AuditLog_${getDateStr()}.json`; a.click();
                }} 
                style={{ padding: '8px 16px', background: '#111', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                ⬇ Export Audit Log
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(auditLog?.length ?? 0) === 0 && (
                <div style={{ background: '#FFF', border: '1px solid #EBEBEB', padding: '40px', textAlign: 'center', color: '#AAA', borderRadius: '8px' }}>
                  No audit events recorded yet. All future actions will appear here.
                </div>
              )}
              {auditLog?.map((entry, i) => (
                <div key={`${entry.id}-${i}`} style={{ background: '#FFF', border: '1px solid #EBEBEB', borderRadius: '6px', padding: '12px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#888', flexShrink: 0, paddingTop: '2px' }}>{entry.timestamp}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: BLUE_TEXT, background: BLUE_LIGHT, padding: '1px 6px', borderRadius: '3px' }}>{entry.action}</span>
                      <span style={{ fontSize: '10px', color: '#888', background: '#F3F4F6', padding: '1px 5px', borderRadius: '3px' }}>{entry.targetType?.toUpperCase()}</span>
                      <span style={{ fontSize: '10px', color: '#AAA', fontFamily: 'monospace' }}>{entry.targetId?.substring(0, 20)}...</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#444' }}>{entry.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
