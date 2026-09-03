import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { FACILITY_TYPE_LABELS, FACILITY_TYPE_COLORS } from '../constants/facilityTypes';
import './Dashboard.css';
import './Patients.css';
import './Facilities.css';

// react-leaflet + bundlers can't resolve the default marker icon URLs; point them at the bundled assets explicitly.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const FACILITIES_URL = 'http://localhost:5000/api/facilities';
const GORAKHPUR_CENTER = [26.76, 83.37];

const iconCache = {};
function iconForType(type) {
  if (!iconCache[type]) {
    const color = FACILITY_TYPE_COLORS[type] || '#666';
    iconCache[type] = L.divIcon({
      className: 'facility-marker-icon',
      html: `<span style="background:${color}"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  }
  return iconCache[type];
}

function Facilities() {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState(null);
  const [error, setError] = useState('');

  const [expandedFacilityId, setExpandedFacilityId] = useState(null);
  const [availabilityByFacility, setAvailabilityByFacility] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState({});
  const [availabilityError, setAvailabilityError] = useState({});

  async function loadAvailability(facilityId) {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setAvailabilityLoading((prev) => ({ ...prev, [facilityId]: true }));
    setAvailabilityError((prev) => ({ ...prev, [facilityId]: '' }));
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [medicinesRes, staffRes, equipmentRes] = await Promise.all([
        fetch(`${FACILITIES_URL}/${facilityId}/medicines`, { headers }),
        fetch(`${FACILITIES_URL}/${facilityId}/staff`, { headers }),
        fetch(`${FACILITIES_URL}/${facilityId}/equipment`, { headers }),
      ]);

      if (medicinesRes.status === 401 || staffRes.status === 401 || equipmentRes.status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      if (!medicinesRes.ok || !staffRes.ok || !equipmentRes.ok) {
        setAvailabilityError((prev) => ({
          ...prev,
          [facilityId]: 'Could not load availability. Please try again.',
        }));
        return;
      }

      const [medicines, staff, equipment] = await Promise.all([
        medicinesRes.json(),
        staffRes.json(),
        equipmentRes.json(),
      ]);

      setAvailabilityByFacility((prev) => ({ ...prev, [facilityId]: { medicines, staff, equipment } }));
    } catch {
      setAvailabilityError((prev) => ({
        ...prev,
        [facilityId]: 'Could not reach the server. Please try again.',
      }));
    } finally {
      setAvailabilityLoading((prev) => ({ ...prev, [facilityId]: false }));
    }
  }

  function handleToggleAvailability(facilityId) {
    if (expandedFacilityId === facilityId) {
      setExpandedFacilityId(null);
      return;
    }
    setExpandedFacilityId(facilityId);
    if (!availabilityByFacility[facilityId]) {
      loadAvailability(facilityId);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(FACILITIES_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        if (!res.ok) {
          setError('Could not load facilities. Please try again.');
          return;
        }

        setFacilities(await res.json());
      } catch {
        setError('Could not reach the server. Please try again.');
      }
    })();
  }, [navigate]);

  return (
    <div className="dashboard-page">
      <div className="patients-container facilities-container">
        <Link to="/dashboard" className="back-link">
          ← Back to Dashboard
        </Link>
        <h1>Facilities</h1>

        {error && <p className="form-error">{error}</p>}

        {!error && facilities === null && <p className="dashboard-loading">Loading...</p>}

        {!error && facilities !== null && (
          <>
            <div className="facilities-map-wrapper">
              <MapContainer center={GORAKHPUR_CENTER} zoom={10} style={{ height: '420px', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {facilities
                  .filter((f) => f.latitude != null && f.longitude != null)
                  .map((facility) => (
                    <Marker
                      key={facility.id}
                      position={[facility.latitude, facility.longitude]}
                      icon={iconForType(facility.type)}
                    >
                      <Popup>
                        <strong>{facility.name}</strong>
                        <br />
                        {FACILITY_TYPE_LABELS[facility.type] || facility.type}
                        <br />
                        {facility.block}
                        {facility.phone && (
                          <>
                            <br />
                            {facility.phone}
                          </>
                        )}
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>

            <div className="facilities-list">
              <h2>All Facilities</h2>
              {facilities.length === 0 && <p className="dashboard-loading">No facilities yet.</p>}
              {facilities.length > 0 && (
              <ul>
                {facilities.map((facility) => {
                  const availability = availabilityByFacility[facility.id];
                  const isExpanded = expandedFacilityId === facility.id;

                  const medicines = availability?.medicines || [];
                  const staff = availability?.staff || [];
                  const equipment = availability?.equipment || [];

                  const medicinesInStock = medicines.filter((m) => m.in_stock).length;
                  const specialtiesPresent = staff.filter((s) => s.available_count > 0).length;
                  const equipmentAvailable = equipment.filter((e) => e.available).length;

                  return (
                    <li key={facility.id} className="facility-list-item">
                      <span
                        className="facility-dot"
                        style={{ background: FACILITY_TYPE_COLORS[facility.type] || '#666' }}
                      />
                      <div className="facility-list-content">
                        <strong>{facility.name}</strong>
                        <div className="facility-meta">
                          {FACILITY_TYPE_LABELS[facility.type] || facility.type} · {facility.block || 'Unknown block'}
                          {facility.phone ? ` · ${facility.phone}` : ''}
                        </div>

                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleToggleAvailability(facility.id)}
                        >
                          {isExpanded ? 'Hide Availability' : 'View Availability'}
                        </button>

                        {isExpanded && (
                          <div className="availability-panel">
                            {availabilityLoading[facility.id] && <p className="dashboard-loading">Loading...</p>}
                            {availabilityError[facility.id] && (
                              <p className="form-error">{availabilityError[facility.id]}</p>
                            )}
                            {availability && (
                              <>
                                <div className="availability-section">
                                  <h3 className="availability-section-title">Medicines</h3>
                                  {medicines.length === 0 ? (
                                    <p className="dashboard-loading">No medicines recorded yet.</p>
                                  ) : (
                                    <>
                                      <p className="medicines-summary">
                                        {medicinesInStock}/{medicines.length} medicines available
                                      </p>
                                      <ul className="medicines-list">
                                        {medicines.map((med) => (
                                          <li key={med.id} className="medicine-item">
                                            <span className={med.in_stock ? 'medicine-check' : 'medicine-cross'}>
                                              {med.in_stock ? '✓' : '✕'}
                                            </span>
                                            <span>{med.medicine_name}</span>
                                            {!med.in_stock && (
                                              <span className="medicine-unavailable-badge">Not available</span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </>
                                  )}
                                </div>

                                <div className="availability-section">
                                  <h3 className="availability-section-title">Specialists & Staff</h3>
                                  <p className="medicines-summary">
                                    {specialtiesPresent}/{staff.length} specialties present
                                  </p>
                                  <ul className="medicines-list">
                                    {staff.map((s) => (
                                      <li key={s.id} className="medicine-item">
                                        <span className={s.available_count === 0 ? 'staff-name-unavailable' : ''}>
                                          {s.specialty}
                                        </span>
                                        <span
                                          className={`staff-count-badge${
                                            s.available_count === 0 ? ' staff-count-zero' : ''
                                          }`}
                                        >
                                          {s.available_count} available
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="availability-section">
                                  <h3 className="availability-section-title">Equipment</h3>
                                  <p className="medicines-summary">
                                    {equipmentAvailable}/{equipment.length} equipment available
                                  </p>
                                  <ul className="medicines-list">
                                    {equipment.map((eq) => (
                                      <li key={eq.id} className="medicine-item">
                                        <span className={eq.available ? 'medicine-check' : 'medicine-cross'}>
                                          {eq.available ? '✓' : '✕'}
                                        </span>
                                        <span>{eq.equipment_name}</span>
                                        {!eq.available && (
                                          <span className="medicine-unavailable-badge">Not available</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Facilities;
