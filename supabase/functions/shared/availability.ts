/**
 * Availability Checker
 * Checks provider availability and returns available slots
 * Medibill Voice Sync Health - Phase 1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export interface TimeSlot {
  time: string; // HH:MM format
  available: boolean;
}

export interface AvailabilityResult {
  provider_id: string;
  provider_name: string;
  date: string;
  available_slots: string[]; // Array of time strings
  total_slots: number;
}

/**
 * Check available appointment slots for a provider on a specific date
 */
export async function checkAvailability(
  providerName: string,
  date: string, // YYYY-MM-DD
  appointmentType?: string,
  duration: number = 30
): Promise<AvailabilityResult> {
  console.log('Checking availability:', {
    providerName,
    date,
    appointmentType,
    duration
  });

  // 1. Load all active providers for this clinic
  const { data: providers, error: providerError } = await supabase
    .from('providers')
    .select('id, name, working_hours, slot_duration, buffer_time')
    .eq('clinic_id', DEFAULT_CLINIC_ID)
    .eq('is_active', true);

  console.log('Providers query result:', {
    foundCount: providers?.length || 0,
    providers: providers?.map(p => ({
      name: p.name,
      id: p.id
    })),
    error: providerError?.message
  });

  if (providerError || !providers || providers.length === 0) {
    console.error('Error finding providers or none active:', providerError);
    throw new Error('No active providers found for this clinic');
  }

  // --- Helper: normalize and match provider names robustly ----------------
  const normalize = (value: string | null | undefined) =>
    (value || '').trim().toLowerCase();

  const requestedName = normalize(providerName);

  // If caller/agent says "any provider", "first available", etc.
  const wantsAnyProvider =
    !requestedName ||
    ['any', 'anyone', 'any provider', 'first available', 'no preference'].some(phrase =>
      requestedName.includes(phrase),
    );

  // Compute availability for a single provider (reuses existing logic)
  const computeAvailabilityForProvider = async (provider: any): Promise<AvailabilityResult> => {
    const providerId = provider.id;
    const fullProviderName = provider.name;

    console.log('Computing availability for provider:', {
      providerId,
      fullProviderName
    });

    // 2. Check provider working hours for this date
    const dateObj = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getDay()];
    const workingHours = provider.working_hours as Record<string, any> | null;
    const dayHours = workingHours?.[dayOfWeek];

    // Strict check: Provider must have working_hours configured and the day must be explicitly enabled
    if (!workingHours ||
        typeof workingHours !== 'object' ||
        Object.keys(workingHours).length === 0 ||
        !dayHours ||
        dayHours.enabled !== true ||
        !dayHours.start ||
        !dayHours.end) {
      console.log('Provider not available on this day (no hours configured):', {
        providerId,
        fullProviderName,
        dayOfWeek,
        hasWorkingHours: !!workingHours,
        dayHours,
        workingHoursKeys: workingHours ? Object.keys(workingHours) : []
      });
      return {
        provider_id: providerId,
        provider_name: fullProviderName,
        date,
        available_slots: [],
        total_slots: 0,
      };
    }

    // Get start and end times (must be set if we got here)
    const startTime = dayHours.start;
    const endTime = dayHours.end;
    const slotDuration = provider.slot_duration || 30;
    const breaks: Array<{ start: string; end: string; label?: string }> = dayHours.breaks || [];

    console.log('Provider working hours:', {
      providerId,
      fullProviderName,
      dayOfWeek,
      startTime,
      endTime,
      slotDuration,
      breaks,
      enabled: dayHours?.enabled !== false
    });

    // 3. Get existing appointments for this provider on this date
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('start_time, end_time, duration, status')
      .eq('provider_id', providerId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled');

    console.log('Existing appointments query:', {
      providerId,
      date,
      foundCount: appointments?.length || 0,
      appointments: appointments?.map(a => ({
        start_time: a.start_time,
        end_time: a.end_time,
        duration: a.duration,
        status: a.status
      })),
      error: appointmentsError?.message
    });

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw new Error('Failed to fetch appointments');
    }

    // 4. Generate time slots based on provider's working hours
    const allSlots = generateTimeSlots(startTime, endTime, slotDuration);

    // 5. Build set of slots blocked by existing appointments
    const occupiedSlots = new Set<string>();
    appointments?.forEach(apt => {
      const aptStartTime = apt.start_time?.substring(0, 5) || '';
      const aptDuration = apt.duration || 30;

      // Mark all slots occupied by this appointment (using provider's slot_duration)
      const slotsNeeded = Math.ceil(aptDuration / slotDuration);
      for (let i = 0; i < slotsNeeded; i++) {
        const slotTime = addMinutes(aptStartTime, i * slotDuration);
        occupiedSlots.add(slotTime);
      }
    });

    // Helper: check whether a slot (start + slotDuration) overlaps any break period
    const isSlotDuringBreak = (slotTime: string): boolean => {
      const [sh, sm] = slotTime.split(':').map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = slotStart + slotDuration;

      for (const brk of breaks) {
        const [bh, bm] = brk.start.split(':').map(Number);
        const [eh, em] = brk.end.split(':').map(Number);
        const brkStart = bh * 60 + bm;
        const brkEnd = eh * 60 + em;
        if (slotStart < brkEnd && slotEnd > brkStart) return true;
      }
      return false;
    };

    // 6. Filter available slots — not occupied by an appointment AND not during a break
    const availableSlots = allSlots.filter(
      slot => !occupiedSlots.has(slot) && !isSlotDuringBreak(slot),
    );

    console.log('Availability calculation:', {
      providerId,
      fullProviderName,
      totalPossibleSlots: allSlots.length,
      occupiedSlots: Array.from(occupiedSlots),
      occupiedCount: occupiedSlots.size,
      availableSlots: availableSlots,
      availableCount: availableSlots.length
    });

    // 7. If appointment duration > slot duration, ensure consecutive slots are available
    if (duration > slotDuration) {
      const slotsNeeded = Math.ceil(duration / slotDuration);
      const consecutiveSlots = availableSlots.filter(slot => {
        // Check if the next (slotsNeeded - 1) slots are also available
        for (let i = 1; i < slotsNeeded; i++) {
          const nextSlot = addMinutes(slot, i * slotDuration);
          if (!availableSlots.includes(nextSlot)) {
            return false;
          }
        }
        return true;
      });

      console.log(`Final result (${duration}min appointments):`, {
        providerId,
        fullProviderName,
        slotsNeeded,
        consecutiveSlots,
        total: consecutiveSlots.length
      });

      return {
        provider_id: providerId,
        provider_name: fullProviderName,
        date,
        available_slots: consecutiveSlots,
        total_slots: consecutiveSlots.length,
      };
    }

    console.log('Final result:', {
      providerId,
      provider: fullProviderName,
      date,
      available_slots: availableSlots,
      total_slots: availableSlots.length
    });

    return {
      provider_id: providerId,
      provider_name: fullProviderName,
      date,
      available_slots: availableSlots,
      total_slots: availableSlots.length,
    };
  };

  // 2. If no specific provider is requested, search across all providers
  if (wantsAnyProvider) {
    console.log('No specific provider requested; searching all providers for best availability');
    const results: AvailabilityResult[] = [];

    for (const p of providers) {
      try {
        const r = await computeAvailabilityForProvider(p);
        if (r.total_slots > 0) {
          results.push(r);
        }
      } catch (err) {
        console.error('Error computing availability for provider (skipping):', {
          provider_id: p.id,
          provider_name: p.name,
          error: (err as Error).message,
        });
      }
    }

    if (results.length === 0) {
      console.log('No providers have availability on this date; returning empty slots for first provider');
      return await computeAvailabilityForProvider(providers[0]);
    }

    // Pick provider with the most available slots
    results.sort((a, b) => b.total_slots - a.total_slots);
    const best = results[0];

    console.log('Best provider for ANY-provider request:', {
      provider_id: best.provider_id,
      provider_name: best.provider_name,
      total_slots: best.total_slots,
    });

    return best;
  }

  // 3. Try to match provider by name (exact, starts-with, contains)
  let provider =
    providers.find(p => normalize(p.name) === requestedName) ||
    providers.find(p => normalize(p.name).startsWith(requestedName)) ||
    providers.find(p => normalize(p.name).includes(requestedName));

  // 4. Fuzzy match fallback if nothing matched above
  if (!provider) {
    const similarity = (a: string, b: string): number => {
      if (!a || !b) return 0;
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      if (longer.length === 0) return 1.0;
      const dp: number[][] = [];
      for (let i = 0; i <= shorter.length; i++) dp[i] = [i];
      for (let j = 0; j <= longer.length; j++) dp[0][j] = j;
      for (let i = 1; i <= shorter.length; i++) {
        for (let j = 1; j <= longer.length; j++) {
          if (shorter[i - 1] === longer[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = Math.min(
              dp[i - 1][j - 1] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j] + 1,
            );
          }
        }
      }
      const dist = dp[shorter.length][longer.length];
      return (longer.length - dist) / longer.length;
    };

    let bestMatch: any = null;
    let bestScore = 0;

    for (const p of providers) {
      const score = similarity(normalize(p.name), requestedName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && bestScore >= 0.6) {
      console.log('Using fuzzy provider match:', {
        requestedName,
        matchedName: bestMatch.name,
        score: bestScore,
      });
      provider = bestMatch;
    }
  }

  // 5. If still no provider match, gracefully fall back to "any provider" search
  if (!provider) {
    console.warn('Provider not found by name; falling back to ANY provider search', {
      searchedName: providerName,
      availableProviders: providers.map(p => p.name),
    });

    // Reuse the ANY-provider branch locally instead of throwing
    const results: AvailabilityResult[] = [];
    for (const p of providers) {
      try {
        const r = await computeAvailabilityForProvider(p);
        if (r.total_slots > 0) {
          results.push(r);
        }
      } catch (err) {
        console.error('Error computing availability for provider (skipping):', {
          provider_id: p.id,
          provider_name: p.name,
          error: (err as Error).message,
        });
      }
    }

    if (results.length === 0) {
      return await computeAvailabilityForProvider(providers[0]);
    }

    results.sort((a, b) => b.total_slots - a.total_slots);
    return results[0];
  }

  // 6. Normal single-provider path
  return await computeAvailabilityForProvider(provider);
}

/**
 * Generate time slots between start and end time
 */
function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const slots: string[] = [];
  let current = startTime;

  while (current < endTime) {
    slots.push(current);
    current = addMinutes(current, intervalMinutes);
  }

  return slots;
}

/**
 * Add minutes to a time string (HH:MM format)
 */
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/*
 * Usage Example:
 *
 * const result = await checkAvailability('Dr. Johnson', '2024-12-10', 'General Checkup', 30);
 * console.log('Available slots:', result.available_slots);
 * // Output: ['08:00', '08:30', '09:00', '14:00', '14:30', ...]
 */
