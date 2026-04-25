// App.jsx
// RIMS NICU Tracker application

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

// Fallback configuration for local usage
const fallbackConfig = {
    apiKey: "AIzaSyBHYARZ5NZIH3QUNOaVijmP8gvUQUfHdK8",
    authDomain: "rims-nicu-tracker.firebaseapp.com",
    projectId: "rims-nicu-tracker",
    storageBucket: "rims-nicu-tracker.firebasestorage.app",
    messagingSenderId: "330632025948",
    appId: "1:330632025948:web:353247817bf1138f359399",
    measurementId: "G-87Q44YRFDY"
};

// Initialize Firebase
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : fallbackConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Constants
const STATUS_OPTIONS = [
    { value: 'Admitted', label: 'Admitted', color: 'bg-blue-100 text-blue-700 border-blue-300', hex: '#3b82f6', icon: '🏥', gradient: 'from-blue-400 to-blue-600' },
    { value: 'Discharged', label: 'Discharged', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', hex: '#10b981', icon: '🏠', gradient: 'from-emerald-400 to-emerald-600' },
    { value: 'Died', label: 'Death', color: 'bg-red-100 text-red-700 border-red-300', hex: '#ef4444', icon: '💔', gradient: 'from-red-400 to-red-600' },
    { value: 'LAMA', label: 'LAMA', color: 'bg-amber-100 text-amber-700 border-amber-300', hex: '#f59e0b', icon: '⚠️', gradient: 'from-amber-400 to-amber-600' },
    { value: 'Transferred', label: 'Transfer', color: 'bg-purple-100 text-purple-700 border-purple-300', hex: '#8b5cf6', icon: '➡️', gradient: 'from-purple-400 to-purple-600' }
];

const DIAGNOSIS_OPTIONS = ['Pre Term', 'Severe Birth Asphyxia', 'SEPSIS', 'RDS', 'Others'];

// Utility functions
function calculateHoursBetween(startStr, endStr) {
    if (!startStr || !endStr) return null;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start) || isNaN(end)) return null;
    return (end - start) / (1000 * 60 * 60);
}

function formatAgeString(hours) {
    if (hours === null || hours < 0) return 'Invalid';
    if (hours < 24) return `DOL 1 (${Math.floor(hours)}h)`;
    const days = Math.floor(hours / 24);
    const rem = Math.floor(hours % 24);
    return `DOL ${days + 1} (${days}d ${rem}h)`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Download CSV Utility
function downloadCSV(csvArray, filename) {
    const csvContent = csvArray.map(row =>
        row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // release the object URL once download has been triggered
    URL.revokeObjectURL(url);
}

// Visual Components
function Badge({ status, size = 'normal' }) {
    const config = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    const sizeClasses = size === 'large' ? 'px-4 py-2 text-sm' : 'px-3 py-1 text-xs';
    return (
        <span className={`inline-flex items-center space-x-1.5 ${sizeClasses} rounded-full font-semibold border-2 ${config.color} shadow-sm transition-transform hover:scale-105`}>
            <span className="text-sm">{config.icon}</span>
            <span>{status}</span>
        </span>
    );
}

function StatCard({ title, count, icon, gradient, onClick, isActive }) {
    return (
        <div onClick={onClick} className={`cursor-pointer bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg text-white`}>
                    <span className="text-2xl">{icon}</span>
                </div>
                {count > 0 && title === "Admitted" && (
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-xs text-gray-500">Active</span>
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">{title}</p>
                <div className="flex items-baseline space-x-2">
                    <h3 className="text-3xl font-black text-gray-900 tabular-nums">{count}</h3>
                    <span className="text-sm text-gray-500">patients</span>
                </div>
            </div>
        </div>
    );
}

// Chart Components
function BarChart({ data }) {
    const maxVal = Math.max(...data.map(d => Math.max(d.admissions, d.discharges, 1)));

    return (
        <div className="overflow-x-auto pb-4 scrollbar-hide">
            <div className="h-64 flex items-end justify-between space-x-2 pt-8 min-w-[500px]">
                {data.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative min-w-[24px]">
                        <div className="absolute -top-14 bg-gray-900 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none shadow-lg">
                            <div className="font-bold border-b border-gray-700 pb-1 mb-1">{item.label}</div>
                            <div className="text-blue-300">Admissions: {item.admissions}</div>
                            <div className="text-emerald-300">Discharges: {item.discharges}</div>
                        </div>
                        <div className="w-full h-48 flex items-end justify-center space-x-0.5 sm:space-x-1">
                            <div className="w-1/2 bg-blue-500 rounded-t-sm transition-all duration-1000 ease-out hover:bg-blue-400" style={{ height: `${(item.admissions / maxVal) * 100}%`, minHeight: item.admissions > 0 ? '4px' : '0' }}></div>
                            <div className="w-1/2 bg-emerald-500 rounded-t-sm transition-all duration-1000 ease-out hover:bg-emerald-400" style={{ height: `${(item.discharges / maxVal) * 100}%`, minHeight: item.discharges > 0 ? '4px' : '0' }}></div>
                        </div>
                        <div className="mt-2 text-[10px] sm:text-xs font-semibold text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center" title={item.label}>
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DonutChart({ data }) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let cumulativePercent = 0;

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-48 h-48">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                    {total > 0 && data.map((slice, i) => {
                        const percent = (slice.value / total) * 100;
                        const dashArray = `${percent} ${100 - percent}`;
                        const dashOffset = 100 - cumulativePercent;
                        cumulativePercent += percent;
                        return percent > 0 ? (
                            <circle key={i} cx="18" cy="18" r="15.915" fill="transparent" stroke={slice.color} strokeWidth="4" strokeDasharray={dashArray} strokeDashoffset={dashOffset} className="transition-all duration-1000 ease-out hover:stroke-w-6 cursor-pointer" />
                        ) : null;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-800">{total}</span>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</span>
                </div>
            </div>
            <div className="flex flex-col space-y-3">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                        <div className="flex justify-between w-32">
                            <span className="text-sm font-medium text-gray-600">{item.label}</span>
                            <span className="text-sm font-bold text-gray-900">{item.value} <span className="text-gray-400 text-xs font-normal">({total > 0 ? Math.round((item.value/total)*100) : 0}%)</span></span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    return (
        <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-bottom-5`}>
            <span className="text-xl">{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="ml-4 hover:opacity-80 transition-opacity">✕</button>
        </div>
    );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center"><span className="text-3xl">⚠️</span></div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600">{message}</p>
                </div>
                <div className="flex space-x-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">Cancel</button>
                    <button onConfirm={onConfirm} className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all shadow-lg hover:shadow-xl">Delete</button>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    const [activeTab, setActiveTab] = useState('tracker');
    const [patients, setPatients] = useState([]);
    
    // Tracker Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    
    // Report Filters
    const [reportFilterPreset, setReportFilterPreset] = useState('This Month');
    const [reportDateRange, setReportDateRange] = useState({ start: '', end: '' });

    // Modals & States
    const [user, setUser] = useState(null);
    const [isSyncing, setIsSyncing] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '', uhid: '', dob: '', admissionDate: '',
        unit: 'NICU', admissionType: 'Direct', diagnosis: DIAGNOSIS_OPTIONS[0],
        status: STATUS_OPTIONS[0].value, outcomeDate: '', notes: ''
    });

    const getCollectionPath = () => typeof __firebase_config !== 'undefined' ? `artifacts/${appId}/public/data/patients` : 'patients';

    // Firebase Auth & Data Fetching
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error('Auth error:', err);
                showToast('Failed to connect to database', 'error');
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        setIsSyncing(true);
        const q = collection(db, getCollectionPath());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setPatients(fetched);
            setIsSyncing(false);
        }, (error) => {
            console.error('Data Sync Error:', error);
            showToast('Data sync error', 'error');
            setIsSyncing(false);
        });
        return () => unsubscribe();
    }, [user]);

    const showToast = useCallback((message, type = 'info') => setToast({ message, type, key: Date.now() }), []);

    // Derived Data for Tracker Tab
    const stats = useMemo(() => ({
        total: patients.length,
        admitted: patients.filter(p => p.status === 'Admitted').length,
        discharged: patients.filter(p => p.status === 'Discharged').length,
        died: patients.filter(p => p.status === 'Died').length,
        lama: patients.filter(p => p.status === 'LAMA').length,
        transferred: patients.filter(p => p.status === 'Transferred').length,
    }), [patients]);

    const filteredPatients = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = !searchQuery || (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) || (p.uhid && p.uhid.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesFilter = filterStatus === 'All' || p.status === filterStatus;
            return matchesSearch && matchesFilter;
        }).sort((a, b) => new Date(b.admissionDate) - new Date(a.admissionDate));
    }, [patients, searchQuery, filterStatus]);


    // --- Derived Data for Reports Tab (Filtered by Date) ---
    const activeReportData = useMemo(() => {
        let start, end, isDaily = false;
        const now = new Date();

        if (reportFilterPreset === 'All Time') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date();
            if (patients.length > 0) {
                const dates = patients.map(p => new Date(p.admissionDate).getTime()).filter(t => !isNaN(t));
                if (dates.length > 0) start = new Date(Math.min(...dates));
            }
            start = new Date(start.getFullYear(), start.getMonth(), 1); // Round down to start of month
        } else if (reportFilterPreset === 'This Month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            isDaily = true;
        } else if (reportFilterPreset === 'Last Month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            isDaily = true;
        } else if (reportFilterPreset === 'Custom') {
            start = reportDateRange.start ? new Date(reportDateRange.start) : new Date(now.getFullYear(), 0, 1);
            end = reportDateRange.end ? new Date(reportDateRange.end) : new Date();
            end.setHours(23, 59, 59, 999);
            
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
            if (diffDays <= 31) isDaily = true;
        }

        const reportFilteredPatients = patients.filter(p => {
            if (!p.admissionDate) return false;
            const d = new Date(p.admissionDate);
            return d >= start && d <= end;
        });

        const buckets = [];
        let current = new Date(start);

        if (isDaily) {
            while (current <= end) {
                const label = current.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                const bucketStart = new Date(current); bucketStart.setHours(0,0,0,0);
                const bucketEnd = new Date(current); bucketEnd.setHours(23,59,59,999);
                buckets.push({ label, start: bucketStart, end: bucketEnd });
                current.setDate(current.getDate() + 1);
            }
        } else {
            current.setDate(1);
            while (current <= end || (current.getMonth() === end.getMonth() && current.getFullYear() === end.getFullYear())) {
                const label = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const bucketStart = new Date(current.getFullYear(), current.getMonth(), 1);
                const bucketEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
                buckets.push({ label, start: bucketStart, end: bucketEnd });
                current.setMonth(current.getMonth() + 1);
            }
        }

        const bucketStats = buckets.map(b => {
            const timePatients = reportFilteredPatients.filter(p => {
                const d = new Date(p.admissionDate);
                return d >= b.start && d <= b.end;
            });
            const row = { label: b.label, patients: timePatients, total: timePatients.length };
            row.nicuAdmissions = timePatients.filter(p => p.unit === 'NICU').length;
            row.sncuDirect = timePatients.filter(p => p.unit === 'SNCU' && p.admissionType === 'Direct').length;
            row.sncuTransfer = timePatients.filter(p => p.unit === 'SNCU' && p.admissionType === 'Transfer in').length;
            row.sncuTotal = row.sncuDirect + row.sncuTransfer;
            
            row.nicuDeaths = timePatients.filter(p => p.status === 'Died' && p.unit === 'NICU').length;
            row.sncuDeaths = timePatients.filter(p => p.status === 'Died' && p.unit === 'SNCU').length;
            row.totalDeaths = row.nicuDeaths + row.sncuDeaths;
            
            row.nicuDischarge = timePatients.filter(p => p.status === 'Discharged' && p.unit === 'NICU').length;
            row.sncuDischarge = timePatients.filter(p => p.status === 'Discharged' && p.unit === 'SNCU').length;
            row.totalDischarge = row.nicuDischarge + row.sncuDischarge;
            
            row.lama = timePatients.filter(p => p.status === 'LAMA').length;
            row.transfer = timePatients.filter(p => p.status === 'Transferred').length;
            
            const deaths = timePatients.filter(p => p.status === 'Died');
            row.deathUnder24 = 0; row.death1to7d = 0; row.death8to28d = 0; row.deathOver28d = 0;
            deaths.forEach(p => {
                const hrs = calculateHoursBetween(p.dob, p.outcomeDate);
                if (hrs === null || hrs < 0) return;
                if (hrs < 24) row.deathUnder24++; else if (hrs >= 24 && hrs < 168) row.death1to7d++; else if (hrs >= 168 && hrs <= 672) row.death8to28d++; else row.deathOver28d++;
            });
            return row;
        });

        return { filteredPatients: reportFilteredPatients, bucketStats, isDaily };
    }, [patients, reportFilterPreset, reportDateRange]);

    const trendChartData = useMemo(() => activeReportData.bucketStats.map(r => ({
        label: r.label, admissions: r.total, discharges: r.totalDischarge
    })).filter(r => r.admissions > 0 || r.discharges > 0), [activeReportData]);

    const donutChartData = useMemo(() => {
        const counts = {};
        activeReportData.filteredPatients.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1;
        });
        return STATUS_OPTIONS.map(opt => ({
            label: opt.label, value: counts[opt.value] || 0, color: opt.hex
        })).filter(d => d.value > 0);
    }, [activeReportData]);


    // --- Handlers & Actions ---
    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const openModal = (patient = null) => {
        if (patient) {
            setEditingPatient(patient);
            setFormData({
                name: patient.name || '', uhid: patient.uhid || '', dob: patient.dob || '', admissionDate: patient.admissionDate || '',
                unit: patient.unit || 'NICU', admissionType: patient.admissionType || 'Direct', diagnosis: patient.diagnosis || DIAGNOSIS_OPTIONS[0],
                status: patient.status || STATUS_OPTIONS[0].value, outcomeDate: patient.outcomeDate || '', notes: patient.notes || ''
            });
        } else {
            setEditingPatient(null);
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const localDatetimeString = now.toISOString().slice(0, 16);
            setFormData({
                name: '', uhid: '', dob: localDatetimeString, admissionDate: localDatetimeString,
                unit: 'NICU', admissionType: 'Direct', diagnosis: DIAGNOSIS_OPTIONS[0],
                status: STATUS_OPTIONS[0].value, outcomeDate: '', notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingPatient(null); };

    const savePatient = async (e) => {
        e.preventDefault();
        if (!user) return;
        setIsLoading(true);
        try {
            const collRef = collection(db, getCollectionPath());
            const dataToSave = { ...formData, updatedAt: serverTimestamp() };
            if (editingPatient) {
                await updateDoc(doc(db, getCollectionPath(), editingPatient.id), dataToSave);
                showToast('Patient record updated successfully', 'success');
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collRef, dataToSave);
                showToast('New patient added successfully', 'success');
            }
            closeModal();
        } catch (error) { console.error("Error saving: ", error); showToast('Error saving record', 'error'); }
        finally { setIsLoading(false); }
    };

    const confirmDeletePatient = async () => {
        if (!confirmDelete || !user) return;
        try {
            await deleteDoc(doc(db, getCollectionPath(), confirmDelete.id));
            showToast('Patient record deleted', 'success');
        } catch (error) { console.error("Error deleting: ", error); showToast('Failed to delete', 'error'); }
        finally { setConfirmDelete(null); }
    };

    // --- Export Functions ---
    const exportTrackerToExcel = () => {
        const headers = ['Patient Name', 'UHID', 'Date of Birth', 'Admission Date', 'Unit', 'Admission Type', 'Diagnosis', 'Status', 'Outcome Date', 'Clinical Notes'];
        const rows = filteredPatients.map(p => [
            p.name, p.uhid, formatDate(p.dob), formatDate(p.admissionDate),
            p.unit, p.admissionType, p.diagnosis, p.status,
            p.outcomeDate ? formatDate(p.outcomeDate) : '', p.notes || ''
        ]);
        downloadCSV([headers, ...rows], `NICU_Patients_Registry_${new Date().toISOString().slice(0,10)}.csv`);
        showToast('Registry exported successfully', 'success');
    };

    const exportReportToExcel = () => {
        const headers = [
            activeReportData.isDaily ? 'Date' : 'Month',
            'Total Admissions', 'NICU Admissions', 'SNCU Total', 'SNCU Direct', 'SNCU Transfer',
            'Total Deaths', 'NICU Deaths', 'SNCU Deaths',
            'Total Discharges', 'NICU Discharges', 'SNCU Discharges',
            'LAMA', 'Transfer'
        ];
        const rows = activeReportData.bucketStats.map(row => [
            row.label,
            row.total, row.nicuAdmissions, row.sncuTotal, row.sncuDirect, row.sncuTransfer,
            row.totalDeaths, row.nicuDeaths, row.sncuDeaths,
            row.totalDischarge, row.nicuDischarge, row.sncuDischarge,
            row.lama, row.transfer
        ]);
        downloadCSV([headers, ...rows], `NICU_Aggregate_Report_${new Date().toISOString().slice(0,10)}.csv`);
        showToast('Report exported successfully', 'success');
    };


    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <style dangerouslySetInnerHTML={{__html: `
                .gradient-mesh { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                .table-row-hover:hover { background: linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%); transform: scale(1.001); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
            
            {/* Header */}
            <header className="gradient-mesh text-white sticky top-0 z-30 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                                <span className="text-2xl">👶</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight drop-shadow-md">RIMS NICU Tracker</h1>
                                <div className="flex items-center text-blue-100 text-sm font-medium space-x-2">
                                    <span>Real-time Registry</span>
                                    {isSyncing ? (
                                        <span className="flex items-center text-yellow-300">
                                            <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-yellow-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Syncing...
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-green-300"><span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span> Live</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md">
                            <button onClick={() => setActiveTab('tracker')} className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'tracker' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-blue-50 hover:bg-white/20'}`}>Tracker</button>
                            <button onClick={() => setActiveTab('reports')} className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'reports' ? 'bg-white text-blue-700 shadow-md transform scale-105' : 'text-blue-50 hover:bg-white/20'}`}>Reports & Analytics</button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {activeTab === 'tracker' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Statistics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
                            <StatCard title="Total Registry" count={stats.total} icon="📋" gradient="from-gray-400 to-gray-600" onClick={() => setFilterStatus('All')} isActive={filterStatus === 'All'} />
                            <StatCard title="Admitted" count={stats.admitted} icon="🏥" gradient="from-blue-400 to-blue-600" onClick={() => setFilterStatus('Admitted')} isActive={filterStatus === 'Admitted'} />
                            <StatCard title="Discharged" count={stats.discharged} icon="🏠" gradient="from-emerald-400 to-emerald-600" onClick={() => setFilterStatus('Discharged')} isActive={filterStatus === 'Discharged'} />
                            <StatCard title="Death" count={stats.died} icon="💔" gradient="from-red-400 to-red-600" onClick={() => setFilterStatus('Died')} isActive={filterStatus === 'Died'} />
                            <StatCard title="LAMA" count={stats.lama} icon="⚠️" gradient="from-amber-400 to-amber-600" onClick={() => setFilterStatus('LAMA')} isActive={filterStatus === 'LAMA'} />
                            <StatCard title="Transferred" count={stats.transferred} icon="➡️" gradient="from-purple-400 to-purple-600" onClick={() => setFilterStatus('Transferred')} isActive={filterStatus === 'Transferred'} />
                        </div>

                        {/* Controls Bar */}
                        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm border border-gray-100">
                            <div className="relative w-full lg:w-96 group flex-1">
                                <div class                                         