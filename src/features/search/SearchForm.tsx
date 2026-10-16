import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CityCombobox } from './CityCombobox';
import { DateRangePicker } from './DateRangePicker';
import { GuestsRoomsPicker } from './GuestsRoomsPicker';
import { Button } from '@/components/Button';
import { addDays, iso, parseDate, today } from '@/lib/dates';
import type { Trip } from '@/types';
import './search.css';
import { t } from '@/lib/i18n';

export interface SearchSubmit {
  trip: Trip;
  /** Set when a property (not a city) was picked from the suggestions. */
  propertyId: string;
}

interface Props {
  trip: Trip;
  onSubmit: (r: SearchSubmit) => void;
  /** The property page edits dates and guests only. */
  hideCity?: boolean;
  /** No button: every change is applied 250ms after the last one (the property page's trip editor). */
  instant?: boolean;
}

const INSTANT_MS = 250;

const tripKey = (t: Trip) => `${t.checkIn}.${t.checkOut}.${t.guests}.${t.rooms}`;

/** Where · when · who, used on Home, in the results page's inline Edit and on the property page (docs/05 SearchForm). */
export function SearchForm({ trip, onSubmit, hideCity, instant }: Props) {
  const hall = trip.type === 'hall';
  const [city, setCity] = useState(trip.city);
  const [propertyId, setPropertyId] = useState('');
  const [dates, setDates] = useState({ checkIn: trip.checkIn, checkOut: trip.checkOut });
  const [party, setParty] = useState({ guests: trip.guests, rooms: trip.rooms });

  const build = (d = dates, p = party): SearchSubmit => {
    // The dates may have gone stale while the form sat open (e.g. past midnight).
    let checkIn = d.checkIn;
    let checkOut = hall ? addDays(checkIn, 1) : d.checkOut;
    if (parseDate(checkIn) < today()) checkIn = iso(today());
    if (parseDate(checkOut) <= parseDate(checkIn)) checkOut = addDays(checkIn, 1);
    return {
      trip: {
        type: trip.type,
        city: hideCity ? trip.city : city.trim(),
        checkIn,
        checkOut,
        guests: p.guests,
        rooms: hall ? 1 : Math.min(p.rooms, p.guests),
      },
      propertyId: hideCity ? '' : propertyId,
    };
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(build());
  };

  // Instant mode: apply the latest values once changes pause. A pending apply is dropped if the form goes away, so it
  // can never navigate after the page was left.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const [sentKey, setSentKey] = useState('');
  const apply = (d: typeof dates, p: typeof party) => {
    if (!instant) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = build(d, p);
      setSentKey(tripKey(r.trip));
      onSubmit(r);
    }, INSTANT_MS);
  };

  // The URL moved on its own (Back, Forward, the basket): show it. Our own change coming back is left alone, so a
  // popover being used is never rebuilt under the finger.
  const key = tripKey(trip);
  const [synced, setSynced] = useState(key);
  if (instant && key !== synced) {
    setSynced(key);
    if (key !== sentKey) {
      setDates({ checkIn: trip.checkIn, checkOut: trip.checkOut });
      setParty({ guests: trip.guests, rooms: trip.rooms });
    }
  }

  return (
    <form className="sform" noValidate autoComplete="off" onSubmit={submit}>
      {hideCity ? null : (
        <CityCombobox
          type={trip.type}
          value={city}
          onChange={(v) => {
            setCity(v.city);
            setPropertyId(v.propertyId);
          }}
        />
      )}
      <DateRangePicker
        hall={hall}
        checkIn={dates.checkIn}
        checkOut={dates.checkOut}
        onChange={(d) => {
          setDates(d);
          apply(d, party);
        }}
      />
      <GuestsRoomsPicker
        hall={hall}
        guests={party.guests}
        rooms={party.rooms}
        onChange={(p) => {
          setParty(p);
          apply(dates, p);
        }}
      />
      {instant ? null : <Button type="submit">{t('Search')}</Button>}
    </form>
  );
}
