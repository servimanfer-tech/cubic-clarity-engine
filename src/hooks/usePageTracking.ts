import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_ID_KEY = "cce_visitor_id";

/**
 * Devuelve un identificador anónimo persistente para este navegador.
 * Se guarda en localStorage y nunca contiene datos personales.
 */
const getOrCreateVisitorId = (): string => {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // Si localStorage está bloqueado (modo incógnito estricto), generamos uno efímero.
    return crypto.randomUUID();
  }
};

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

      const visitor_id = getOrCreateVisitorId();

      await supabase.from("page_visits").insert({
        path: location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        country,
        city,
        visitor_id,
      });
    };

    track();
  }, [location.pathname]);
};
