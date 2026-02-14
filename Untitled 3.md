=== Rotations and rotary reflections ===
Rotations and [[rotary reflection]]s are constructed by a single single-generator product of all the reflections of a prismatic group, [2''p'']×[2''q'']×... where [[Greatest common divisor|gcd]](''p'',''q'',...)=1, they are isomorphic to the abstract [[cyclic group]] Z<sub>n</sub>, of order ''n''=2''pq''.

The 4-dimensional double rotations, [2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>] (with [[Greatest common divisor|gcd]](''p'',''q'')=1), which include a central group, and are expressed by Conway as ±[C<sub>''p''</sub>×C<sub>''q''</sub>],<ref>Conway, 2003, p.46, Table 4.2 Chiral groups II</ref> order 2''pq''. From Coxeter diagram {{CDD|node_n0|2x|p|node_n1|2|node_n2|2x|q|node_n3}}, generators {0,1,2,3}, requires two generator for [2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>], {{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h2}} as {0123,0132}. Half groups, [2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>]<sup>+</sup>, or cyclic graph, [(2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>)], {{CDD|3|node_h4|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x}} expressed by Conway is [C<sub>''p''</sub>×C<sub>''q''</sub>], order ''pq'', with one generator, like {0123}.

If there is a common factor ''f'', the double rotation can be written as {{frac|1|''f''}}[2''pf''<sup>+</sup>,2<sup>+</sup>,2''qf''<sup>+</sup>] (with [[Greatest common divisor|gcd]](''p'',''q'')=1), generators {0123,0132}, order 2''pqf''. For example, ''p''=''q''=1, ''f''=2, {{frac|1|2}}[4<sup>+</sup>,2<sup>+</sup>,4<sup>+</sup>] is order 4. And {{frac|1|''f''}}[2''pf''<sup>+</sup>,2<sup>+</sup>,2''qf''<sup>+</sup>]<sup>+</sup>, generator {0123}, is order ''pqf''. For example, {{frac|1|2}}[4<sup>+</sup>,2<sup>+</sup>,4<sup>+</sup>]<sup>+</sup> is order 2, a [[central inversion]].

In general a ''n''-rotation group, [2''p''<sub>1</sub><sup>+</sup>,2,2''p''<sub>2</sub><sup>+</sup>,2,...,''p''<sub>''n''</sub><sup>+</sup>] may require up to ''n'' generators if gcd(''p''<sub>1</sub>,..,''p''<sub>''n''</sub>)>1, as a product of all mirrors, and then swapping sequential pairs. The half group, [2''p''<sub>1</sub><sup>+</sup>,2,2''p''<sub>2</sub><sup>+</sup>,2,...,''p''<sub>''n''</sub><sup>+</sup>]<sup>+</sup> has generators squared. ''n''-rotary reflections are similar.

{| class=wikitable style="text-align:center;"
|+ Examples
! Dimension
! Coxeter notation
! Order
! Coxeter diagram
! Operation
! Generators
!colspan=2| Direct subgroup
|-
!2
||[2''p'']<sup>+</sup>||rowspan=6|2''p''||{{CDD|node_h2|2x|p|node_h2}}||[[rotation (geometry)|Rotation]]||{01}||[2''p'']<sup>+2</sup> = [''p'']<sup>+</sup>||rowspan=6|Simple rotation:<BR>[2''p'']<sup>+2</sup> = [''p'']<sup>+</sup><BR>order ''p''
|-
!3
||[2''p''<sup>+</sup>,2<sup>+</sup>]||{{CDD|node_h2|2x|p|node_h4|2x|node_h2}}||[[rotary reflection]]||{012}||[2''p''<sup>+</sup>,2<sup>+</sup>]<sup>+</sup> = [''p'']<sup>+</sup>
|-
!4
||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]
||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|node_h2}}||[[double rotation]]||{0123}||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup> = [''p'']<sup>+</sup>
|-
!5
||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|node_h4|2x|node_h2}}||double rotary reflection||{01234}||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup> = [''p'']<sup>+</sup>
|-
!6
||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]
|{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|node_h4|2x|node_h4|2x|node_h2}}||triple rotation||{012345}||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup> = [''p'']<sup>+</sup>
|-
!7
||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]
|{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|node_h4|2x|node_h4|2x|node_h4|2x|node_h2}}||triple rotary reflection||{0123456}||[2''p''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup> = [''p'']<sup>+</sup>
|-
!4
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>]
|rowspan=4|2''pq''
||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h2}}||double rotation||{0123,<BR>0132}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>]<sup>+</sup>
|rowspan=4|Double rotation:<BR>[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>]<sup>+</sup><BR>order ''pq''
|-
!5
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>]||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x|node_h2}}||double rotary reflection||{01234,<BR>01243}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>]<sup>+</sup>
|-
!6
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]
|{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x|node_h4|2x|node_h2}}||triple rotation||{012345,<BR>012354,<BR>013245}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup>
|-
!7
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x|node_h4|2x|node_h4|2x|node_h2}}||triple rotary reflection||{0123456,<BR>0123465,<BR>0124356,<BR>0124356}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>,2<sup>+</sup>]<sup>+</sup>
|-
!6
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2''r''<sup>+</sup>]
|rowspan=2|2''pqr''||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x|node_h4|2x|r|node_h2}}||triple rotation||{012345,<BR>012354,<BR>013245}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2''r''<sup>+</sup>]<sup>+</sup>
|rowspan=2|Triple rotation:<BR>[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2''r''<sup>+</sup>]<sup>+</sup><BR>order ''pqr''
|-
!7
||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2''r''<sup>+</sup>,2<sup>+</sup>]||{{CDD|node_h2|2x|p|node_h4|2x|node_h4|2x|q|node_h4|2x|node_h4|2x|r|node_h4|2x|node_h2}}||triple rotary reflection||{0123456,<BR>0123465,<BR>0124356,<BR>0213456}||[2''p''<sup>+</sup>,2<sup>+</sup>,2''q''<sup>+</sup>,2<sup>+</sup>,2''r''<sup>+</sup>,2<sup>+</sup>]<sup>+</sup>
|}
