/* BUNDLED DEMONSTRATION DATA.
 *
 * This is the ONLY data source Milestone A has, and it is a plain JavaScript
 * literal shipped with the site. Opening `?demo=wedding_romantic_v1` performs
 * no database query, needs no invitation record, no authentication, no preview
 * token and no mobile editor. There is no `fetch` in this module tree at all,
 * so "demo mode makes zero Supabase requests" is a property of the code rather
 * than a promise about it.
 *
 * WHY IT MATTERS THAT THIS IS SHAPED LIKE REAL DATA
 * The object below is a RAW configuration — exactly what Milestone B's editor
 * will write into the invitation's JSONB column. It goes through the same
 * `normalizeConfig()` as a stored one, so anything wrong with the contract
 * shows up here first, while it is still free to change.
 *
 * The content is fictional. It is deliberately ONE couple's invitation with one
 * date, one city and one voice, because a component catalogue cannot answer the
 * question this milestone exists to ask: does this look like something you would
 * send to your guests?
 */

/** Demo configurations, keyed by registry identifier. Null-prototype: a lookup
 *  can never reach an inherited member. */
const DEMOS = Object.create(null);

DEMOS.wedding_romantic_v1 = {
    contractVersion: 1,
    categoryKey: 'wedding',
    templateKey: 'wedding_romantic',
    templateVersion: 1,
    locale: 'es-MX',
    timeZone: 'America/Mexico_City',

    sections: {
        hero: {
            eyebrow: 'Nos casamos',
            partnerA: 'Valentina',
            partnerB: 'Mateo',
            date: '2027-04-17T17:00:00-06:00',
            location: 'San Miguel de Allende, Guanajuato',
            image: { source: 'demo', path: 'wedding-romantic/hero.svg' },
            imageAlt: 'Ilustración de un arco de flores y follaje en tonos marfil y rosa empolvado',
        },

        message: {
            heading: 'Nuestra invitación',
            body: 'Hay días que se recuerdan toda la vida, y este queremos vivirlo contigo.\n\n'
                + 'Después de once años de caminar juntos, decidimos unir nuestras vidas para siempre. '
                + 'Nos haría muy felices que nos acompañes en la celebración de nuestro matrimonio.',
            hosts: 'Con la bendición de nuestros padres: Elena Serrano y Roberto Ruiz · '
                + 'Carmen Lozano y Andrés Herrera',
        },

        countdown: {
            enabled: true,
            // The couple's own wording; absent, the template supplies its own.
            completedLabel: '¡Hoy nos casamos!',
        },

        ceremony: {
            startsAt: '2027-04-17T17:00:00-06:00',
            venueName: 'Parroquia de la Santa Cruz',
            address: 'Calle del Rosal 128, Centro, San Miguel de Allende, Gto.',
            note: 'Te pedimos llegar 20 minutos antes.',
        },

        reception: {
            enabled: true,
            startsAt: '2027-04-17T19:30:00-06:00',
            venueName: 'Hacienda Los Arcos',
            address: 'Camino a La Cañada km 4, San Miguel de Allende, Gto.',
            note: 'Cena, brindis y baile. La fiesta termina a las 3:00 h.',
        },

        dressCode: {
            enabled: true,
            title: 'Formal · Etiqueta jardín',
            description: 'Vestido largo y traje oscuro. La celebración es al aire libre, '
                + 'sobre pasto y empedrado.',
            guidelines: [
                'Evita el tacón de aguja: el camino es de piedra.',
                'La noche refresca; te sugerimos un chal o un saco ligero.',
                'Reservamos el blanco para la novia.',
            ],
        },

        gallery: {
            enabled: true,
            items: [
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-01.svg' },
                    alt: 'Ilustración de dos copas brindando bajo una guirnalda de luces',
                },
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-02.svg' },
                    alt: 'Ilustración de un ramo de peonías y eucalipto',
                },
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-03.svg' },
                    alt: 'Ilustración de una cúpula y campanario al atardecer',
                },
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-04.svg' },
                    alt: 'Ilustración de dos argollas entrelazadas sobre un fondo de lino',
                },
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-05.svg' },
                    alt: 'Ilustración de una mesa larga con velas y follaje',
                },
                {
                    image: { source: 'demo', path: 'wedding-romantic/story-06.svg' },
                    alt: 'Ilustración de un cielo nocturno con papel picado',
                },
            ],
        },

        gifts: {
            enabled: true,
            intro: 'Tu presencia es nuestro regalo más importante. Si además quieres consentirnos, '
                + 'aquí te dejamos algunas ideas. También habrá lluvia de sobres el día de la boda.',
            links: [
                { label: 'Mesa de regalos · Liverpool', url: 'https://mesaderegalos.liverpool.com.mx/' },
                { label: 'Mesa de regalos · Amazon', url: 'https://www.amazon.com.mx/wedding/' },
            ],
        },

        closing: {
            enabled: true,
            heading: 'Nos vemos pronto',
            body: 'Gracias por ser parte de nuestra historia. Nos hace mucha ilusión celebrar contigo '
                + 'el día en que empieza nuestra vida juntos.',
            signature: 'Valentina & Mateo',
        },
    },

    /* PHOTOGRAPHS DISTRIBUTED THROUGH THE INVITATION.
     *
     * Six named slots, not a second gallery. Here they show what the feature is
     * FOR: the reader meets a photograph between one part of the invitation and
     * the next, rather than a block of them at the end. Landscape bands, so
     * they read as full-bleed interludes and not as gallery tiles.
     *
     * A sibling of `sections` — the renderer gives these no heading, and this
     * demonstration is the only place these files are ever referenced. */
    interludeImages: {
        afterMessage: {
            image: { source: 'demo', path: 'wedding-romantic/band-01.svg' },
            alt: 'Ilustración de dos argollas entrelazadas sobre lino claro',
        },
        afterCountdown: {
            image: { source: 'demo', path: 'wedding-romantic/band-02.svg' },
            alt: 'Ilustración de una hilera de velas encendidas',
        },
        afterCeremony: {
            image: { source: 'demo', path: 'wedding-romantic/band-03.svg' },
            alt: 'Ilustración de los arcos de una hacienda al atardecer',
        },
        afterReception: {
            image: { source: 'demo', path: 'wedding-romantic/band-04.svg' },
            alt: 'Ilustración de una mesa larga vestida con follaje',
        },
        afterDressCode: {
            image: { source: 'demo', path: 'wedding-romantic/band-05.svg' },
            alt: 'Ilustración de una guirnalda de eucalipto',
        },
        beforeClosing: {
            image: { source: 'demo', path: 'wedding-romantic/band-06.svg' },
            alt: 'Ilustración de papel picado y luces colgantes',
        },
    },

    actions: { calendar: true, share: true, map: true },
};

/* CLÁSICA ELEGANTE — a second fictional wedding.
 *
 * Deliberately a DIFFERENT couple, city and voice from the romantic demo, so
 * the two routes cannot be mistaken for the same invitation in another skin.
 * The names, venues and guideline copy are also longer on purpose: this is the
 * fixture that proves long content wraps rather than overflowing.
 *
 * Fictional throughout. No real person, no invitation id, no preview token, no
 * smart-invitation code, and every image is a repository-owned demo SVG. */
DEMOS.wedding_classic_gold_v1 = {
    contractVersion: 1,
    categoryKey: 'wedding',
    templateKey: 'wedding_classic_gold',
    templateVersion: 1,
    locale: 'es-MX',
    timeZone: 'America/Mexico_City',

    sections: {
        hero: {
            eyebrow: 'Nuestra boda',
            partnerA: 'María Fernanda',
            partnerB: 'Alejandro',
            date: '2027-11-20T18:00:00-06:00',
            location: 'Santiago de Querétaro, Querétaro',
            image: { source: 'demo', path: 'wedding-classic-gold/hero.svg' },
            imageAlt: 'Ilustración de un marco dorado con dos argollas entrelazadas sobre papel marfil',
        },

        message: {
            heading: 'Nuestra invitación',
            body: 'Con la alegría de quien ha esperado este día, queremos compartirlo contigo.\n\n'
                + 'Después de nueve años, hemos decidido unir nuestras vidas en matrimonio. '
                + 'Nos honraría profundamente contar con tu presencia en una celebración '
                + 'pensada para las personas que más queremos.',
            hosts: 'Con la bendición de nuestros padres: '
                + 'María del Carmen Villalobos y Jorge Alberto San Román · '
                + 'Ana Sofía Echeverría y Luis Fernando Mondragón',
        },

        countdown: {
            enabled: true,
            completedLabel: '¡Hoy es nuestra boda!',
        },

        ceremony: {
            startsAt: '2027-11-20T18:00:00-06:00',
            venueName: 'Templo de Nuestra Señora del Carmen',
            address: 'Av. Ignacio Zaragoza Poniente 145, Centro Histórico, Santiago de Querétaro, Qro.',
            note: 'Te esperamos 30 minutos antes para acompañarnos desde el inicio.',
        },

        reception: {
            enabled: true,
            startsAt: '2027-11-20T20:30:00-06:00',
            venueName: 'Hacienda de los Arcos y Jardines de San Sebastián',
            address: 'Carretera Estatal 411 kilómetro 7.5, El Marqués, Querétaro, Qro.',
            note: 'Cena servida, brindis y baile. La celebración concluye a las 3:00 h.',
        },

        dressCode: {
            enabled: true,
            title: 'Etiqueta rigurosa · Formal de noche',
            description: 'Vestido largo y esmoquin o traje oscuro. La ceremonia es en recinto '
                + 'cerrado y la recepción combina salón y jardín.',
            guidelines: [
                'Reservamos el color blanco y sus tonos para la novia.',
                'La noche en Querétaro es fresca; te sugerimos un chal o un abrigo ligero.',
                'Parte del jardín es de empedrado: considera un tacón estable.',
                'Agradecemos puntualidad para poder recibirte como mereces.',
            ],
        },

        gallery: {
            enabled: true,
            items: [
                { image: { source: 'demo', path: 'wedding-classic-gold/story-01.svg' },
                  alt: 'Ilustración de dos argollas grabadas sobre papel marfil' },
                { image: { source: 'demo', path: 'wedding-classic-gold/story-02.svg' },
                  alt: 'Ilustración de un ramo de laurel dorado' },
                { image: { source: 'demo', path: 'wedding-classic-gold/story-03.svg' },
                  alt: 'Ilustración de una copa de brindis con filo dorado' },
                { image: { source: 'demo', path: 'wedding-classic-gold/story-04.svg' },
                  alt: 'Ilustración de un candelabro clásico de tres velas' },
                { image: { source: 'demo', path: 'wedding-classic-gold/story-05.svg' },
                  alt: 'Ilustración de un monograma enmarcado en un rombo dorado' },
                { image: { source: 'demo', path: 'wedding-classic-gold/story-06.svg' },
                  alt: 'Ilustración de una guirnalda de hojas doradas' },
            ],
        },

        gifts: {
            enabled: true,
            intro: 'Tu compañía es, con mucho, el mejor regalo que podríamos recibir. '
                + 'Si además deseas obsequiarnos algo, aquí encontrarás algunas ideas.',
            links: [
                { label: 'Mesa de regalos · Liverpool', url: 'https://mesaderegalos.liverpool.com.mx/' },
                { label: 'Mesa de regalos · Palacio de Hierro', url: 'https://www.elpalaciodehierro.com/' },
            ],
        },

        closing: {
            enabled: true,
            heading: 'Con cariño',
            body: 'Gracias por acompañarnos en este momento. Celebrar rodeados de nuestras '
                + 'familias y amistades es exactamente como imaginamos empezar esta etapa.',
            signature: 'María Fernanda & Alejandro',
        },
    },

    interludeImages: {
        afterMessage: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-01.svg' },
            alt: 'Ilustración de dos argollas entrelazadas',
        },
        afterCountdown: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-02.svg' },
            alt: 'Ilustración de una rama de laurel dorada',
        },
        afterCeremony: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-03.svg' },
            alt: 'Ilustración de una doble regla dorada con un rombo al centro',
        },
        afterReception: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-04.svg' },
            alt: 'Ilustración de una hilera de velas encendidas',
        },
        afterDressCode: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-05.svg' },
            alt: 'Ilustración de una guirnalda de hojas doradas',
        },
        beforeClosing: {
            image: { source: 'demo', path: 'wedding-classic-gold/band-06.svg' },
            alt: 'Ilustración de un rombo dorado con dos argollas al centro',
        },
    },

    actions: { calendar: true, share: true, map: true },
};

/* BOTÁNICA — a third fictional wedding.
 *
 * A garden ceremony in Coyoacán: again a different couple, city and voice from
 * the other two demos, so no route can be mistaken for another in a new skin.
 * Names, venues and addresses are the longest of the three on purpose — this is
 * the fixture that proves an asymmetric composition still wraps.
 *
 * Fictional throughout. No real person, no invitation id, no preview token, no
 * smart-invitation code, and every image is a repository-owned demo SVG. */
DEMOS.wedding_botanical_v1 = {
    contractVersion: 1,
    categoryKey: 'wedding',
    templateKey: 'wedding_botanical',
    templateVersion: 1,
    locale: 'es-MX',
    timeZone: 'America/Mexico_City',

    sections: {
        hero: {
            eyebrow: 'Nos casamos',
            partnerA: 'Ximena Guadalupe',
            partnerB: 'Sebastián Andrés',
            date: '2028-03-25T17:30:00-06:00',
            location: 'Coyoacán, Ciudad de México',
            image: { source: 'demo', path: 'wedding-botanical/hero.svg' },
            imageAlt: 'Ilustración de un arco de jardín con ramas de eucalipto en tonos crema y salvia',
        },

        message: {
            heading: 'Nuestra invitación',
            body: 'Hay jardines que se siembran despacio, y esta historia se parece mucho a uno.\n\n'
                + 'Después de siete años cuidando lo que empezó como una amistad, hemos decidido '
                + 'casarnos rodeados de árboles, de luz y de la gente que nos ha acompañado en el camino.',
            hosts: 'Con la bendición y el cariño de nuestras familias: '
                + 'Rosa María Betancourt de Villaseñor y Ernesto Villaseñor Aguirre · '
                + 'Leticia Guadalupe Arreola y Francisco Javier Ontiveros del Valle',
        },

        countdown: {
            enabled: true,
            completedLabel: '¡Hoy nos casamos en el jardín!',
        },

        ceremony: {
            startsAt: '2028-03-25T17:30:00-06:00',
            venueName: 'Capilla del Jardín Botánico de San Ángel',
            address: 'Callejón de la Amargura 78, Barrio de San Ángel Inn, Álvaro Obregón, Ciudad de México.',
            note: 'La ceremonia es al aire libre; te pedimos llegar 25 minutos antes.',
        },

        reception: {
            enabled: true,
            startsAt: '2028-03-25T19:45:00-06:00',
            venueName: 'Invernadero y Jardines de la Casa de los Fresnos',
            address: 'Avenida Universidad 1420, Colonia Florida, Álvaro Obregón, Ciudad de México.',
            note: 'Cena bajo los árboles, brindis y baile hasta las 2:30 h.',
        },

        dressCode: {
            enabled: true,
            title: 'Formal de jardín',
            description: 'Vestido largo o midi y traje claro. La celebración ocurre sobre pasto, '
                + 'terracería y andadores de piedra, entre jardineras y árboles antiguos.',
            guidelines: [
                'Te sugerimos un tacón ancho o calzado plano: el jardín es irregular.',
                'La noche en Coyoacán refresca; considera un chal, un rebozo o un saco ligero.',
                'Reservamos el blanco y los tonos marfil para la novia.',
                'Habrá repelente disponible, pero puedes traer el tuyo si lo prefieres.',
            ],
        },

        gallery: {
            enabled: true,
            items: [
                { image: { source: 'demo', path: 'wedding-botanical/story-01.svg' },
                  alt: 'Ilustración de una corona de hojas finas' },
                { image: { source: 'demo', path: 'wedding-botanical/story-02.svg' },
                  alt: 'Ilustración de una rama de eucalipto inclinada' },
                { image: { source: 'demo', path: 'wedding-botanical/story-03.svg' },
                  alt: 'Ilustración de dos ramas de olivo enfrentadas' },
                { image: { source: 'demo', path: 'wedding-botanical/story-04.svg' },
                  alt: 'Ilustración de un arco de jardín con follaje' },
                { image: { source: 'demo', path: 'wedding-botanical/story-05.svg' },
                  alt: 'Ilustración de tres ramas de eucalipto alineadas' },
                { image: { source: 'demo', path: 'wedding-botanical/story-06.svg' },
                  alt: 'Ilustración de un círculo botánico con una rama de olivo' },
            ],
        },

        gifts: {
            enabled: true,
            intro: 'Que nos acompañes ese día ya es el mejor regalo. Si además quieres tener '
                + 'un detalle con nosotros, aquí te dejamos algunas ideas.',
            links: [
                { label: 'Mesa de regalos · Liverpool', url: 'https://mesaderegalos.liverpool.com.mx/' },
                { label: 'Mesa de regalos · Amazon', url: 'https://www.amazon.com.mx/wedding/' },
            ],
        },

        closing: {
            enabled: true,
            heading: 'Te esperamos',
            body: 'Gracias por caminar con nosotros hasta aquí. Nos hace mucha ilusión celebrar '
                + 'contigo, entre árboles y buena compañía, el día en que empezamos esta vida juntos.',
            signature: 'Ximena & Sebastián',
        },
    },

    interludeImages: {
        afterMessage: {
            image: { source: 'demo', path: 'wedding-botanical/band-01.svg' },
            alt: 'Ilustración de dos ramas de eucalipto abriéndose',
        },
        afterCountdown: {
            image: { source: 'demo', path: 'wedding-botanical/band-02.svg' },
            alt: 'Ilustración de una corona botánica abierta',
        },
        afterCeremony: {
            image: { source: 'demo', path: 'wedding-botanical/band-03.svg' },
            alt: 'Ilustración de una línea fina cruzada por ramas de olivo',
        },
        afterReception: {
            image: { source: 'demo', path: 'wedding-botanical/band-04.svg' },
            alt: 'Ilustración de una hilera de ramas de eucalipto',
        },
        afterDressCode: {
            image: { source: 'demo', path: 'wedding-botanical/band-05.svg' },
            alt: 'Ilustración de un arco de jardín junto a una rama',
        },
        beforeClosing: {
            image: { source: 'demo', path: 'wedding-botanical/band-06.svg' },
            alt: 'Ilustración de dos ramas encontrándose en el centro',
        },
    },

    actions: { calendar: true, share: true, map: true },
};

/* EDITORIAL MODERNA — a fourth fictional wedding.
 *
 * A contemporary city wedding in Monterrey: a fourth couple, city and voice, so
 * no route can be mistaken for another in a new skin. The copy is deliberately
 * the most formal-but-modern of the four, and the names, venues and address are
 * the longest yet — this is the fixture that proves very large editorial type
 * still wraps inside a 320 px column.
 *
 * Fictional throughout. No real person, no invitation id, no preview token, no
 * smart-invitation code, and every image is a repository-owned demo SVG. */
DEMOS.wedding_editorial_v1 = {
    contractVersion: 1,
    categoryKey: 'wedding',
    templateKey: 'wedding_editorial',
    templateVersion: 1,
    locale: 'es-MX',
    timeZone: 'America/Monterrey',

    sections: {
        hero: {
            eyebrow: 'Boda · 2028',
            partnerA: 'Regina Montserrat',
            partnerB: 'Maximiliano Andrés',
            date: '2028-06-17T19:00:00-06:00',
            location: 'San Pedro Garza García, Nuevo León',
            image: { source: 'demo', path: 'wedding-editorial/hero.svg' },
            imageAlt: 'Composición editorial abstracta en papel cálido con bloques y marcas de registro',
        },

        message: {
            heading: 'La invitación',
            body: 'Elegimos un sábado de junio, una ciudad que conocemos de memoria y a las '
                + 'personas que han estado en cada versión de nosotros.\n\n'
                + 'Después de una década construyendo una vida en común, queremos celebrarla '
                + 'exactamente como somos: sin protocolo de más, con mesa larga, música alta y '
                + 'la gente correcta. Nos encantaría que fueras parte de esa noche.',
            hosts: 'Con el cariño y la complicidad de nuestras familias: '
                + 'Alejandra Fernanda Berlanga de Treviño y Ricardo Emilio Treviño Cantú · '
                + 'Mariana Isabel Cavazos Zambrano y Gerardo Antonio Elizondo Villarreal',
        },

        countdown: {
            enabled: true,
            completedLabel: 'Hoy es el día',
        },

        ceremony: {
            startsAt: '2028-06-17T19:00:00-06:00',
            venueName: 'Capilla del Antiguo Colegio de San Pedro',
            address: 'Avenida Vasconcelos Poniente 1250, Colonia del Valle, San Pedro Garza García, Nuevo León.',
            note: 'La ceremonia comienza puntual a las 19:00. Te pedimos llegar 20 minutos antes.',
        },

        reception: {
            enabled: true,
            startsAt: '2028-06-17T21:00:00-06:00',
            venueName: 'Terraza y Salón Industrial del Antiguo Molino de Santa Catarina',
            address: 'Calzada del Molino 405, Parque Industrial Poniente, Santa Catarina, Nuevo León.',
            note: 'Cena servida, barra abierta y música hasta las 3:00 h.',
        },

        dressCode: {
            enabled: true,
            title: 'Formal de noche',
            description: 'Vestido largo o cocktail y traje oscuro. La ceremonia es en interior y '
                + 'la recepción combina terraza y salón, así que la noche se pasa entre ambos.',
            guidelines: [
                'Reservamos el blanco y el marfil para la novia.',
                'La terraza es de concreto pulido: te recomendamos un tacón estable.',
                'Habrá servicio de valet en ambas sedes desde las 18:15.',
                'El traslado entre la capilla y el salón toma alrededor de 25 minutos.',
            ],
        },

        gallery: {
            enabled: true,
            items: [
                { image: { source: 'demo', path: 'wedding-editorial/story-01.svg' },
                  alt: 'Composición de bloques desplazados en papel y terracota' },
                { image: { source: 'demo', path: 'wedding-editorial/story-02.svg' },
                  alt: 'Marco fino con una marca de registro al centro' },
                { image: { source: 'demo', path: 'wedding-editorial/story-03.svg' },
                  alt: 'Serie de líneas horizontales sobre papel' },
                { image: { source: 'demo', path: 'wedding-editorial/story-04.svg' },
                  alt: 'Bloque sólido con una ventana recortada al centro' },
                { image: { source: 'demo', path: 'wedding-editorial/story-05.svg' },
                  alt: 'Marcas de corte en las esquinas con una línea de acento' },
                { image: { source: 'demo', path: 'wedding-editorial/story-06.svg' },
                  alt: 'Arco geométrico con un bloque de acento' },
            ],
        },

        gifts: {
            enabled: true,
            intro: 'Que vengas y te quedes hasta el final es, honestamente, todo lo que queremos. '
                + 'Si aun así te nace tener un detalle con nosotros, aquí te dejamos dónde.',
            links: [
                { label: 'Mesa de regalos · Liverpool', url: 'https://mesaderegalos.liverpool.com.mx/' },
                { label: 'Mesa de regalos · Amazon', url: 'https://www.amazon.com.mx/wedding/' },
            ],
        },

        closing: {
            enabled: true,
            heading: 'Nos vemos ahí',
            body: 'Gracias por haber estado antes de que esto fuera una fecha. Nos vemos el 17 '
                + 'de junio, con los zapatos cómodos guardados en el coche.',
            signature: 'Regina & Maximiliano',
        },
    },

    interludeImages: {
        afterMessage: {
            image: { source: 'demo', path: 'wedding-editorial/band-01.svg' },
            alt: 'Bloque sólido junto a una serie de líneas finas',
        },
        afterCountdown: {
            image: { source: 'demo', path: 'wedding-editorial/band-02.svg' },
            alt: 'Marcas de corte con una marca de registro al centro',
        },
        afterCeremony: {
            image: { source: 'demo', path: 'wedding-editorial/band-03.svg' },
            alt: 'Serie de líneas horizontales de ancho completo',
        },
        afterReception: {
            image: { source: 'demo', path: 'wedding-editorial/band-04.svg' },
            alt: 'Dos bloques enfrentados, uno sólido y uno delineado',
        },
        afterDressCode: {
            image: { source: 'demo', path: 'wedding-editorial/band-05.svg' },
            alt: 'Arco geométrico junto a un grupo de líneas',
        },
        beforeClosing: {
            image: { source: 'demo', path: 'wedding-editorial/band-06.svg' },
            alt: 'Marco cuadrado con un bloque de acento al centro',
        },
    },

    actions: { calendar: true, share: true, map: true },
};

/* NOCHE ESTELAR — a fifth fictional wedding.
 *
 * A formal evening wedding in Mérida: a fifth couple, city and voice, so no
 * route can be mistaken for another in a new skin. Romantic and nocturnal in
 * tone, never mystical — there is no astrology here, and no real coordinates.
 * The names, blessing, venues and address are the longest of the five.
 *
 * Fictional throughout. No real person, no invitation id, no preview token, no
 * smart-invitation code, and every image is a repository-owned demo SVG. */
DEMOS.wedding_celestial_v1 = {
    contractVersion: 1,
    categoryKey: 'wedding',
    templateKey: 'wedding_celestial',
    templateVersion: 1,
    locale: 'es-MX',
    timeZone: 'America/Merida',

    sections: {
        hero: {
            eyebrow: 'Nos casamos de noche',
            partnerA: 'Valeria Alejandra',
            partnerB: 'Rodrigo Emiliano',
            date: '2028-10-14T20:00:00-06:00',
            location: 'Mérida, Yucatán',
            image: { source: 'demo', path: 'wedding-celestial/hero.svg' },
            imageAlt: 'Ilustración de un arco nocturno con una luna creciente y estrellas doradas',
        },

        message: {
            heading: 'Nuestra invitación',
            body: 'Nos conocimos una noche de octubre, en una terraza donde no se veía casi '
                + 'nada y se escuchaba todo.\n\n'
                + 'Ocho años después queremos casarnos exactamente así: de noche, con velas, '
                + 'con el cielo abierto sobre nosotros y con las personas que han sostenido '
                + 'esta historia desde el principio. Nos haría muy felices que estuvieras ahí.',
            hosts: 'Con la bendición y el cariño de nuestras familias: '
                + 'Silvia Margarita Peniche de Sandoval y Joaquín Alberto Sandoval Cámara · '
                + 'Rocío Guadalupe Interián Loría y Martín Eduardo Baeza Villanueva',
        },

        countdown: {
            enabled: true,
            completedLabel: 'Esta noche nos casamos',
        },

        ceremony: {
            startsAt: '2028-10-14T20:00:00-06:00',
            venueName: 'Capilla de la Antigua Hacienda Santa Rosa de Lima',
            address: 'Carretera Mérida–Maxcanú kilómetro 32.5, Comisaría de Santa Rosa, Maxcanú, Yucatán.',
            note: 'La ceremonia comienza a las 20:00 en punto, a la luz de las velas.',
        },

        reception: {
            enabled: true,
            startsAt: '2028-10-14T22:00:00-06:00',
            venueName: 'Jardín de Noche y Terraza de la Casa Principal de la Hacienda',
            address: 'Acceso por el camino interior de la hacienda, 400 metros después de la capilla.',
            note: 'Cena bajo las estrellas, brindis y baile hasta las 4:00 h.',
        },

        dressCode: {
            enabled: true,
            title: 'Etiqueta de noche',
            description: 'Vestido largo y esmoquin o traje oscuro. La celebración es al aire '
                + 'libre, sobre pasto y piso de pasta antiguo, bajo un cielo despejado de octubre.',
            guidelines: [
                'Reservamos el blanco y el marfil para la novia.',
                'La noche en la hacienda es cálida pero húmeda; un chal ligero es suficiente.',
                'Te sugerimos un tacón ancho: parte del jardín es de piedra irregular.',
                'Habrá transporte desde Mérida a las 18:45, con regreso a las 2:00 y a las 4:00 h.',
            ],
        },

        gallery: {
            enabled: true,
            items: [
                { image: { source: 'demo', path: 'wedding-celestial/story-01.svg' },
                  alt: 'Ilustración de una luna creciente dorada con un destello' },
                { image: { source: 'demo', path: 'wedding-celestial/story-02.svg' },
                  alt: 'Ilustración de una constelación trazada con líneas finas' },
                { image: { source: 'demo', path: 'wedding-celestial/story-03.svg' },
                  alt: 'Ilustración de un arco nocturno dorado' },
                { image: { source: 'demo', path: 'wedding-celestial/story-04.svg' },
                  alt: 'Ilustración de tres velas encendidas bajo destellos' },
                { image: { source: 'demo', path: 'wedding-celestial/story-05.svg' },
                  alt: 'Ilustración de un círculo dorado con dos estrellas' },
                { image: { source: 'demo', path: 'wedding-celestial/story-06.svg' },
                  alt: 'Ilustración de una silueta de horizonte con luna creciente' },
            ],
        },

        gifts: {
            enabled: true,
            intro: 'Que vengas y te quedes hasta que se apaguen las velas es todo lo que '
                + 'queremos. Si además te nace tener un detalle con nosotros, aquí te dejamos dónde.',
            links: [
                { label: 'Mesa de regalos · Liverpool', url: 'https://mesaderegalos.liverpool.com.mx/' },
                { label: 'Mesa de regalos · Amazon', url: 'https://www.amazon.com.mx/wedding/' },
            ],
        },

        closing: {
            enabled: true,
            heading: 'Nos vemos esa noche',
            body: 'Gracias por haber estado en las noches anteriores a esta. Nos vemos el 14 '
                + 'de octubre, cuando ya haya oscurecido y todo empiece.',
            signature: 'Valeria & Rodrigo',
        },
    },

    interludeImages: {
        afterMessage: {
            image: { source: 'demo', path: 'wedding-celestial/band-01.svg' },
            alt: 'Ilustración de una constelación trazada de extremo a extremo',
        },
        afterCountdown: {
            image: { source: 'demo', path: 'wedding-celestial/band-02.svg' },
            alt: 'Ilustración de una luna creciente sobre un cielo estrellado',
        },
        afterCeremony: {
            image: { source: 'demo', path: 'wedding-celestial/band-03.svg' },
            alt: 'Ilustración de un arco nocturno entre dos destellos',
        },
        afterReception: {
            image: { source: 'demo', path: 'wedding-celestial/band-04.svg' },
            alt: 'Ilustración de una silueta de horizonte nocturno',
        },
        afterDressCode: {
            image: { source: 'demo', path: 'wedding-celestial/band-05.svg' },
            alt: 'Ilustración de una hilera de velas con destellos dorados',
        },
        beforeClosing: {
            image: { source: 'demo', path: 'wedding-celestial/band-06.svg' },
            alt: 'Ilustración de una línea dorada con una estrella al centro',
        },
    },

    actions: { calendar: true, share: true, map: true },
};

/**
 * Look up a demonstration configuration.
 * @returns {?object} a DEEP COPY, so a renderer can never mutate the bundled
 *   literal and leak state between renders.
 */
export function demoConfig(id) {
    if (typeof id !== 'string' || id === '') return null;
    if (!Object.prototype.hasOwnProperty.call(DEMOS, id)) return null;
    return JSON.parse(JSON.stringify(DEMOS[id]));
}

/** Every demonstration identifier this build ships. */
export function listDemoIds() {
    return Object.keys(DEMOS);
}
