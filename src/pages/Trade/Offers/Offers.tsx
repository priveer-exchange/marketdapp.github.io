import {useParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {message} from "antd";
import {useChainId} from "wagmi";
import {useQuery} from "@tanstack/react-query";
import {useContract} from "hooks/useContract";
import {useOffers} from "hooks/useOffers";
import OffersTable from "./OffersTable";
import OffersFilters from "./OffersFilters";
import TokenNav from "./TokenNav";

export default function Offers({filter: superFilter = null})
{
    const chainId = useChainId();
    const { Market } = useContract();

    /**
     * Fetch offers from the GraphQL. It then must calculate price and be filtered by amount.
     */
    const {
        side = 'sell',
        token = 'WBTC',
        fiat = 'USD',
        method = undefined
    } = useParams();
    const {
        offers: rawOffers,
        totalCount,
        loadMore,
        refetch,
        loading: listLoading,
        error
    } = useOffers({
        filter: superFilter || {
            disabled: false,
            isSell: side.toLowerCase() === 'buy',
            token: token,
            fiat: fiat,
            method: method
        },
        order: side === 'buy' ? 'asc' : 'desc'
    })
    useEffect(() => {
        if (error) {
            console.error(error.message);
            // noinspection JSIgnoredPromiseFromCall
            message.error('Failed to load offers');
        }
    }, [error]);
    useEffect(() => {
        refetch(); // FIXME update Apollo URI for the new network
    }, [chainId]);

    /**
     * Fetch market price of token in fiat and apply to offer rates.
     */
    const [allOffers, setAllOffers] = useState(null);
    const { data: marketPrice, isLoading: priceLoading } = useQuery({
        queryKey: ['marketPrice'+chainId, {token, fiat}],
        queryFn: () => Market.getPrice(token, fiat).then(price => Number(price / 10000n) / 100),
        staleTime: 30000,
    });
    useEffect(() => {
        if (!rawOffers || !marketPrice) return;
        const offers = rawOffers.map(offer => {
            const rate = Number(offer.rate) / 10**4;
            return {
                ...offer,
                rate: rate,
                price: (marketPrice * rate).toFixed(2)
            }
        });
        setAllOffers(offers);
    }, [rawOffers, marketPrice]);

    /**
     * Construct the final offers list, filtered locally.
     */
    const [offers, setOffers] = useState(null);
    const [filterAmount, setFilterAmount] = useState('');
    useEffect(() => {
        if (!allOffers) return;
        if (filterAmount === '') {
            setOffers(allOffers);
        } else {
            setOffers(allOffers.filter(offer => offer.minFiat <= filterAmount && offer.maxFiat >= filterAmount));
        }
    }, [filterAmount, allOffers]);

    return (
    <>
        <TokenNav />
        <OffersFilters setFilterAmount={setFilterAmount} />
        <OffersTable offers={offers || []}
                 loading={offers === null || listLoading || priceLoading}
                 loadMore={loadMore}
                 totalOffers={totalCount}
    />
    </>);
}
