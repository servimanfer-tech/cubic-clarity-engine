import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registra una visita en la tabla page_visits cada vez que cambia la ruta.
 * Intenta capturar el país/ciudad a través de un servicio gratuito de geolocalización.
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const track = async () => {
      let country: string | null = null;
      let city: string | null = null;

      try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const data = await res.json();
          country = data.country_name ?? null;
          city = data.city ?? null;
        }
      } catch {
        // Silencioso: si falla la geolocalización, igual registramos la visita.
      }

      await supabase.from("page_visits").insert({
        path: location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        country,
        city,
      });
    };

    track();
  }, [location.pathname]);
};
