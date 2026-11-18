// Truco · Cómo se juega: el reglamento corto (cartas, manos, envido, truco, flor), cómo se anota con
// fósforos (malas y buenas) y cómo se usa el anotador de la web.
import type { ReactNode } from 'react'
import { TRUCO } from '../../content/truco'
import { formatPoints } from '../../domain/fmo'
import { Card, PageHeader } from '../../ui/components'
import { Fosforos, TrucoTabs } from './trucoShared'

const JERARQUIA: Array<{ cards: string; note?: string }> = [
  { cards: '1 de espada', note: 'el ancho de espada, la más alta' },
  { cards: '1 de basto', note: 'el ancho de basto' },
  { cards: '7 de espada' },
  { cards: '7 de oro' },
  { cards: 'Los 3' },
  { cards: 'Los 2' },
  { cards: '1 de copa y 1 de oro', note: 'los anchos falsos' },
  { cards: 'Los 12' },
  { cards: 'Los 11' },
  { cards: 'Los 10' },
  { cards: '7 de copa y 7 de basto', note: 'los sietes falsos' },
  { cards: 'Los 6' },
  { cards: 'Los 5' },
  { cards: 'Los 4', note: 'las más bajas' },
]

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <p className="h3 mb-2">{title}</p>
      <div className="small grid gap-2">{children}</div>
    </Card>
  )
}

function Cantos({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="tiny muted text-left">
          <th className="py-1 pr-2">Canto</th>
          <th className="py-1 pr-2 text-right">Querido</th>
          <th className="py-1 text-right">No quiero</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([c, q, n]) => (
          <tr key={c} className="border-t border-line">
            <td className="py-1.5 pr-2 font-semibold">{c}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{q}</td>
            <td className="py-1.5 text-right tabular-nums">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function TrucoReglas() {
  return (
    <div>
      <PageHeader eyebrow="Truco" title="Cómo se juega" intro="El reglamento corto del truco argentino, cómo se anota con fósforos y cómo se usa el anotador de la web." />
      <TrucoTabs />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="grid gap-4">
          <Block title="Lo básico">
            <p>Se juega con la baraja española de 40 cartas (sin 8, 9 ni comodines), de a 2 (mano a mano), de a 4 (2 vs 2) o de a 6 (3 vs 3). En equipo, los compañeros se sientan intercalados.</p>
            <p>A cada uno se le reparten 3 cartas. El que está a la derecha del que reparte es <b>mano</b>: juega primero y gana los empates del envido. El que reparte va rotando.</p>
          </Block>

          <Block title="Cómo se gana una mano">
            <p>Se juegan hasta 3 vueltas (bazas), una carta cada uno. Gana la mano el que gana 2.</p>
            <p>
              <b>Parda</b> (empate): si se empata la primera, gana el que gane la segunda. Si se empata la segunda o la tercera, gana el que ganó la primera. Si se empatan todas, gana el mano.
            </p>
            <p>Si nadie canta truco, la mano vale 1 punto. Si alguien se va al mazo, el otro se lleva lo que valía la mano en ese momento.</p>
          </Block>

          <Block title="Qué carta mata a cuál">
            <ol className="grid gap-1">
              {JERARQUIA.map((j, i) => (
                <li key={j.cards} className="flex items-baseline gap-2">
                  <span className="tiny muted w-5 text-right tabular-nums shrink-0">{i + 1}</span>
                  <span>
                    <b>{j.cards}</b>
                    {j.note ? <span className="muted"> · {j.note}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Block>
        </div>

        <div className="grid gap-4">
          <Block title="Envido">
            <p>Se canta antes de jugar la primera carta. Se suman dos cartas del mismo palo y se agregan 20 (los 10, 11 y 12 valen 0). Ejemplo: 7 y 5 de espada = 32. El máximo es 33.</p>
            <p>Si no tenés dos del mismo palo, vale tu carta más alta (las figuras valen 0). Si empatan, gana el mano.</p>
            <Cantos
              rows={[
                ['Envido', '2', '1'],
                ['Envido, envido', '4', '2'],
                ['Real envido', '3', '1'],
                ['Envido y real envido', '5', '2'],
                ['Falta envido', 'lo que falta', 'lo anterior'],
              ]}
            />
            <p className="tiny muted">La falta envido vale lo que le falta al que va ganando para ganar el partido. Si no la quieren, el que cantó se lleva lo que valía lo cantado antes (o 1 si fue lo primero). Algunas mesas juegan que, si los dos están en las malas, la falta es por el partido entero: lo acuerdan antes.</p>
          </Block>

          <Block title="Truco">
            <Cantos
              rows={[
                ['Truco', '2', '1'],
                ['Retruco', '3', '2'],
                ['Vale cuatro', '4', '3'],
              ]}
            />
            <p className="tiny muted">Sólo puede subir (retruco, vale cuatro) el que aceptó el último canto. Si no quieren, el que cantó se lleva lo que valía antes.</p>
          </Block>

          <Block title="Flor (si se juega con flor)">
            <p>Se acuerda antes de empezar. Tres cartas del mismo palo son flor: vale 3 puntos y anula el envido. El otro puede responder con contraflor o contraflor al resto.</p>
          </Block>

          <Block title="En equipo">
            <p>Se vale hablar con señas para avisarle al compañero qué tenés. Las clásicas: levantar las cejas es el ancho de espada; guiñar un ojo, el ancho de basto; torcer la boca a un lado y al otro, los sietes bravos (espada y oro).</p>
            <p>En 3 vs 3 hay mesas que juegan pica pica: en la mitad del partido, algunas manos se juegan de a dos, cada uno contra el que tiene enfrente.</p>
          </Block>

          <Block title="Cómo se anota">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <Fosforos score={8} target={15} size={44} animate={false} />
              </div>
              <div className="grid gap-2">
                <p>Con fósforos (o porotos), en cuadrados de 5: los 4 lados y la diagonal. Acá hay 8 puntos: un cuadrado entero y 3 fósforos.</p>
                <p>
                  Un partido <b>a 30</b> se divide en dos: los primeros 15 son <b>las malas</b> y los otros 15 <b>las buenas</b>. Gana el primero que llega a 30. También se juega <b>a 15</b>, sin malas ni buenas.
                </p>
              </div>
            </div>
          </Block>

          <Block title="El anotador de la web">
            <p>
              <b>Nuevo partido</b> → elegís 1 vs 1, 2 vs 2 o 3 vs 3, a 15 o a 30, y quiénes juegan → <b>Empezar a anotar</b>.
            </p>
            <p>La pantalla queda partida en dos: Nosotros y Ellos. Cada vez que tocás un lado, suma un fósforo; si te equivocaste, el − de abajo de ese lado resta uno. Cada punto se guarda solo: los demás lo ven en vivo desde su celular.</p>
            <p>
              Cuando alguien llega, tocás <b>Guardar el partido</b>. Para el ranking, el que gana suma {formatPoints(TRUCO.puntos.gana)} y el que pierde resta {formatPoints(-TRUCO.puntos.pierde)}.
            </p>
          </Block>
        </div>
      </div>
    </div>
  )
}
