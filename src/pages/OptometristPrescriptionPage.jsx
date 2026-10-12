import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import prescriptionService from '../services/prescription/prescriptionService';
import './OptometristPrescriptionPage.css';
import PrescriptionEntryForm from '../components/prescriptions/PrescriptionEntryForm';

export default function OptometristPrescriptionPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const lookupVersion = useRef(0);

  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  function handleQueryChange(event) {
    lookupVersion.current += 1;
    setQuery(event.target.value);
    setCustomers([]);
    setSelectedCustomer(null);
    setErrorMessage('');
    setHasSearched(false);
    setSearching(false);
  }

  async function handleSearch(event) {
    event.preventDefault();

    const searchTerm = query.trim();

    if (searchTerm.length < 2 || searchTerm.length > 100) {
      setErrorMessage('Enter between 2 and 100 characters to search.');
      return;
    }

    const version = ++lookupVersion.current;
    setSearching(true);
    setErrorMessage('');
    setSelectedCustomer(null);
    setCustomers([]);
    setHasSearched(false);

    try {
      const results = await prescriptionService.searchCustomers(searchTerm);

      if (version !== lookupVersion.current) return;

      setCustomers(results);
      setHasSearched(true);
    } catch (error) {
      if (version !== lookupVersion.current) return;

      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (error?.status === 403) {
        setErrorMessage('You do not have permission to search customers.');
      } else {
        setErrorMessage('Unable to search customers. Please try again.');
      }
    } finally {
      if (version === lookupVersion.current) {
        setSearching(false);
      }
    }
  }

  return (
    <main className="clinical-page">
      <header className="clinical-page__header">
        <h1>Record Prescription</h1>
        <p>Find a customer before recording a new optical prescription.</p>
      </header>

      <section
        className="clinical-panel"
        aria-labelledby="customer-selection-title"
      >
        <h2 id="customer-selection-title">Select Customer</h2>

        <form onSubmit={handleSearch} className="clinical-search">
          <label htmlFor="clinical-customer-search">
            Search by customer name, email or phone
          </label>

          <div className="clinical-search__controls">
            <input
              id="clinical-customer-search"
              type="search"
              value={query}
              onChange={handleQueryChange}
              maxLength={100}
              placeholder="Enter at least 2 characters"
            />
            <button type="submit" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {searching && <p role="status">Searching for customers...</p>}

        {errorMessage && (
          <p className="clinical-error" role="alert">
            {errorMessage}
          </p>
        )}

        {!searching && hasSearched && customers.length === 0 && (
          <p role="status">No matching customers found.</p>
        )}

        {customers.length > 0 && (
          <div className="clinical-results">
            <h3>Search Results</h3>
            <ul>
              {customers.map((customer) => (
                <li key={customer.id}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.email}</span>
                    <span>{customer.phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(customer)}
                    aria-label={`Select ${customer.name}`}
                    aria-pressed={selectedCustomer?.id === customer.id}
                  >
                    {selectedCustomer?.id === customer.id
                      ? 'Selected'
                      : 'Select'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {selectedCustomer && (
        <section
          className="clinical-panel"
          aria-labelledby="selected-customer-title"
        >
          <h2 id="selected-customer-title">Selected Customer</h2>
          <p>
            <strong>{selectedCustomer.name}</strong>
          </p>
          <p>{selectedCustomer.email}</p>
          <p role="status">Customer selected.</p>
        </section>
      )}
      {selectedCustomer && (
        <PrescriptionEntryForm
          key={selectedCustomer.id}
          customer={selectedCustomer}
        />
      )}
    </main>
  );
}
