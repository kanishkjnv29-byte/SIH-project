import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddPatient from './pages/AddPatient';
import ViewPatients from './pages/ViewPatients';
import PatientDetail from './pages/PatientDetail';
import Facilities from './pages/Facilities';
import FollowUps from './pages/FollowUps';
import PatientPortal from './pages/PatientPortal';
import PatientRecord from './pages/PatientRecord';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients/new" element={<AddPatient />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients" element={<ViewPatients />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/patient" element={<PatientPortal />} />
        <Route path="/patient/:patientId" element={<PatientRecord />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
