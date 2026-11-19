import { useState } from 'react';
import { BookX } from 'lucide-react';
import { useGetCategoriesQuery, useGetCoursesQuery } from '../../app/api';
import CourseCard from '../../components/CourseCard';
import { EmptyState, ErrorState, Pagination, SearchBox, Select, Skeleton, cx, useDebounced } from '../../components/ui';

export default function Catalog({ standalone }) {
  const [q, setQ] = useState(''); const [category, setCategory] = useState(''); const [level, setLevel] = useState(''); const [priceF, setPriceF] = useState(''); const [sort, setSort] = useState('newest'); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data: cats } = useGetCategoriesQuery();
  const res = useGetCoursesQuery({ q: dq, category, level, price: priceF, sort, page, limit: 9 });
  const set = (fn) => (v) => { fn(v); setPage(1); };
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8" id="catalog">
      <h2 className="font-display text-3xl font-semibold">{standalone ? 'All courses' : 'Explore our courses'}</h2>
      <p className="mt-1 text-stone-500">Hand-reviewed courses with video lessons, quizzes and live classes.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <SearchBox value={q} onChange={set(setQ)} placeholder="Search courses, topics, skills…" />
        <Select aria-label="Level" value={level} onChange={(e) => set(setLevel)(e.target.value)}><option value="">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></Select>
        <Select aria-label="Price" value={priceF} onChange={(e) => set(setPriceF)(e.target.value)}><option value="">Any price</option><option value="free">Free</option><option value="paid">Paid</option></Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => set(setSort)(e.target.value)}><option value="newest">Newest</option><option value="popular">Most popular</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></Select>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {['', ...(cats || [])].map((c) => <button key={c || 'all'} onClick={() => set(setCategory)(c)} className={cx('rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', category === c ? 'border-accent bg-accent text-white' : 'border-stone-300 bg-white text-stone-600 hover:border-accent')}>{c || 'All'}</button>)}
      </div>
      <div className="mt-8">
        {res.isError ? <ErrorState error={res.error} retry={res.refetch} /> : res.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
        ) : res.data.items.length === 0 ? <EmptyState icon={BookX} title="No courses match your filters" message="Try a different search term or clear a filter." /> : (
          <>
            <div className={cx('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', res.isFetching && 'opacity-60 transition')}>{res.data.items.map((c) => <CourseCard key={c._id} course={c} />)}</div>
            <div className="mt-6"><Pagination meta={res.data.meta} onPage={setPage} /></div>
          </>
        )}
      </div>
    </section>
  );
}
