import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { LegalchainLogo } from '~/components/legalchain/logo';

export const Footer = component$(() => {
    return (
        <footer id="contacto" class="relative border-t border-[#4a2e85]/10 bg-white py-12">
            <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div class="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
                    <div class="space-y-4">
                        <div class="flex items-center gap-2">
                            <div class="origin-left scale-[0.82]">
                                <LegalchainLogo compact />
                            </div>
                            <div class="text-lg font-bold text-[#4a2e85]">Legalchain</div>
                        </div>
                        <p class="text-sm text-[#4a2e85]/60">
                            Custodia digital, plantillas y evidencia verificable para operaciones legales.
                        </p>
                    </div>

                    <div>
                        <h4 class="mb-4 font-semibold text-[#4a2e85]">Servicios</h4>
                        <ul class="space-y-2 text-sm text-[#4a2e85]/60">
                            <li><Link href="/templates" class="transition-colors hover:text-[#4a2e85]">Biblioteca de plantillas</Link></li>
                            <li><Link href="/record" class="transition-colors hover:text-[#4a2e85]">Grabar evidencia</Link></li>
                            <li><Link href="/payments" class="transition-colors hover:text-[#4a2e85]">Pagos y tesoreria</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 class="mb-4 font-semibold text-[#4a2e85]">Soporte</h4>
                        <ul class="space-y-2 text-sm text-[#4a2e85]/60">
                            <li><Link href="/signIn" class="transition-colors hover:text-[#4a2e85]">Iniciar sesion</Link></li>
                            <li><Link href="/signUp" class="transition-colors hover:text-[#4a2e85]">Crear cuenta</Link></li>
                            <li><Link href="/controlPanel" class="transition-colors hover:text-[#4a2e85]">Panel de control</Link></li>
                            <li><Link href="/history" class="transition-colors hover:text-[#4a2e85]">Historial</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 class="mb-4 font-semibold text-[#4a2e85]">Contacto</h4>
                        <ul class="space-y-2 text-sm text-[#4a2e85]/60">
                            <li><a href="mailto:soporte@legalchain.local" class="transition-colors hover:text-[#4a2e85]">soporte@legalchain.local</a></li>
                            <li>legalchain.local</li>
                            <li>Caracas, Venezuela</li>
                        </ul>
                    </div>
                </div>

                <div class="border-t border-[#4a2e85]/10 pt-8">
                    <div class="text-center text-sm text-[#4a2e85]/60">
                        (c) {new Date().getFullYear()} Legalchain. Todos los derechos reservados.
                    </div>
                </div>
            </div>
        </footer>
    );
});
