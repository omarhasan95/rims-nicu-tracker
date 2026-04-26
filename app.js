const { useState, useEffect } = React;

function App() {
  const [patients, setPatients] = useState(() => {
    const stored = localStorage.getItem('patients');
    return stored ? JSON.parse(stored) : [];
  });

  const [form, setForm] = useState({
    name: '',
    uhid: '',
    dob: '',
    status: 'Admitted'
  });

  useEffect(() => {
    localStorage.setItem('patients', JSON.stringify(patients));
  }, [patients]);

  const addPatient = (e) => {
    e.preventDefault();
    // simple validation
    if (!form.name || !form.uhid || !form.dob) {
      alert('Please fill all required fields');
      return;
    }
    setPatients([...patients, { ...form, id: Date.now() }]);
    setForm({ name: '', uhid: '', dob: '', status: 'Admitted' });
  };

  const deletePatient = (id) => {
    setPatients(patients.filter(p => p.id !== id));
  };

  const stats = {
    admitted: patients.filter(p => p.status === 'Admitted').length,
    discharged: patients.filter(p => p.status === 'Discharged').length,
    died: patients.filter(p => p.status === 'Died').length,
    lama: patients.filter(p => p.status === 'LAMA').length,
    transferred: patients.filter(p => p.status === 'Transferred').length,
    total: patients.length
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">RIMS NICU Tracker (Offline)</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h2>Total Patients</h2>
          <p>{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>Admitted</h2>
          <p>{stats.admitted}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>Discharged</h2>
          <p>{stats.discharged}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>Died</h2>
          <p>{stats.died}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>LAMA</h2>
          <p>{stats.lama}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>Transferred</h2>
          <p>{stats.transferred}</p>
        </div>
      </div>
      <form onSubmit={addPatient} className="space-y-2 bg-white p-4 rounded shadow">
        <h3 className="text-xl font-semibold">Add Patient</h3>
        <div>
          <label className="block">Name</label>
          <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border p-2 w-full" />
        </div>
        <div>
          <label className="block">UHID</label>
          <input type="text" name="uhid" value={form.uhid} onChange={e => setForm({ ...form, uhid: e.target.value })} className="border p-2 w-full" />
        </div>
        <div>
          <label className="block">Date of Birth</label>
          <input type="date" name="dob" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="border p-2 w-full" />
        </div>
        <div>
          <label className="block">Status</label>
          <select name="status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="border p-2 w-full">
            <option value="Admitted">Admitted</option>
            <option value="Discharged">Discharged</option>
            <option value="Died">Died</option>
            <option value="LAMA">LAMA</option>
            <option value="Transferred">Transferred</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Add</button>
      </form>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-xl font-semibold">Patients List</h3>
        {patients.length === 0 ? (
          <p>No patients yet.</p>
        ) : (
          <table className="min-w-full table-auto">
            <thead>
              <tr>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">UHID</th>
                <th className="border px-2 py-1">DOB</th>
                <th className="border px-2 py-1">Status</th>
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id}>
                  <td className="border px-2 py-1">{p.name}</td>
                  <td className="border px-2 py-1">{p.uhid}</td>
                  <td className="border px-2 py-1">{p.dob}</td>
                  <td className="border px-2 py-1">{p.status}</td>
                  <td className="border px-2 py-1">
                    <button onClick={() => deletePatient(p.id)} className="text-red-500">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
