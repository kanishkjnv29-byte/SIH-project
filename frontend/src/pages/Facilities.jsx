import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
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

const TYPE_COLORS = {
  SUB_CENTRE: '#1a7f37',
  PHC: '#3366ff',
  CHC: '#b35900',
  DISTRICT_HOSPITAL: '#d33',
};

const TYPE_LABELS = {
  SUB_CENTRE: 'Sub-Centre',
  PHC: 'PHC',
  CHC: 'CHC',
  DISTRICT_HOSPITAL: 'District Hospital',
};

const iconCache = {};
function iconForType(type) {
  if (!iconCache[type]) {
    const color = TYPE_COLORS[type] || '#666';
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
                        {TYPE_LABELS[facility.type] || facility.type}
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
              <ul>
                {facilities.map((facility) => (
                  <li key={facility.id} className="facility-list-item">
                    <span
                      className="facility-dot"
                      style={{ background: TYPE_COLORS[facility.type] || '#666' }}
                    />
                    <div>
                      <strong>{facility.name}</strong>
                      <div className="facility-meta">
                        {TYPE_LABELS[facility.type] || facility.type} · {facility.block || 'Unknown block'}
                        {facility.phone ? ` · ${facility.phone}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Facilities;
